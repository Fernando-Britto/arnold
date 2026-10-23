import { runSeed, SEED_EMAIL_DOMAIN } from "../prisma/seed-data";
import { estadoCuotaSocio, periodoDe } from "@/domains/pago/cuota";

/**
 * Prisma simulado: cada `prisma.modelo.metodo(args)` queda registrado.
 * findFirst/findUnique → null (base vacía), create/upsert → objeto con id, count → 0.
 */
type Call = { model: string; method: string; args: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
function fakePrisma(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let n = 0;
  const prisma = new Proxy({}, {
    get: (_t, model: string) =>
      new Proxy({}, {
        get: (_m, method: string) => async (args: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          calls.push({ model, method, args });
          const key = `${model}.${method}`;
          if (key in overrides) return overrides[key];
          if (method === "findFirst" || method === "findUnique") return null;
          if (method === "count") return 0;
          if (method === "deleteMany") return { count: 0 };
          return { id: `${model}-${++n}`, ...(args?.create ?? args?.data ?? {}) };
        },
      }),
  });
  return { prisma: prisma as never, calls };
}

const NOW = new Date("2026-10-07T15:00:00Z");
const hash = async (pw: string) => `hashed:${pw}`;
const run = (p: never, extra = {}) => runSeed(p, { hash, now: NOW, env: "development", password: "Secreta123!", ...extra });

describe("runSeed", () => {
  it("se niega a correr en producción y no toca la base", async () => {
    const { prisma, calls } = fakePrisma();
    await expect(run(prisma, { env: "production" })).rejects.toThrow(/producción/);
    expect(calls).toHaveLength(0);
  });

  it("crea un usuario por rol con la contraseña hasheada (nunca en claro)", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const usuarios = calls.filter((c) => c.model === "usuario" && c.method === "upsert");
    const roles = usuarios.map((c) => c.args.create.rol);
    expect(new Set(roles)).toEqual(new Set(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA", "SOCIO"]));
    for (const u of usuarios) {
      expect(u.args.where.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)).toBe(true);
      expect(u.args.create.password).toBe("hashed:Secreta123!");
      expect(u.args.update.password).toBe("hashed:Secreta123!"); // volver a correr deja el login funcionando
      expect(u.args.update).toMatchObject({ estado: "ACTIVO", deletedAt: null });
    }
    expect(JSON.stringify(calls)).not.toContain('"password":"Secreta123!"');
  });

  it("es repetible: usuarios, empleados y socios con upsert; catálogos solo si no existen", async () => {
    const { prisma, calls } = fakePrisma({
      "ejercicio.findFirst": { id: "ya-existe" },
      "membresia.findFirst": { id: "ya-existe" },
      "rutina.findFirst": { id: "ya-existe" },
      "configuracionDelSistema.findFirst": { id: "cfg", capacidadMaxima: 999 },
      "reglaDeProgresion.findFirst": { id: "regla" },
      "maquina.count": 5,
    });
    await run(prisma);

    for (const model of ["ejercicio", "membresia", "rutina", "configuracionDelSistema", "reglaDeProgresion", "maquina"]) {
      expect(calls.filter((c) => c.model === model && c.method === "create")).toHaveLength(0);
    }
    expect(calls.filter((c) => c.model === "socio" && c.method === "upsert")).toHaveLength(2);
    expect(calls.filter((c) => c.model === "empleado" && c.method === "upsert").length).toBeGreaterThan(0);
  });

  it("borra datos transaccionales solo de los socios del seed, nunca sin filtro", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const borrados = calls.filter((c) => c.method === "deleteMany");
    expect(borrados.length).toBeGreaterThan(0);
    for (const b of borrados) {
      expect(b.args?.where?.socioId?.in).toHaveLength(2);
    }
  });

  it("carga datos para las pantallas: cuota vigente y vencida, asistencias, progreso, pago, sesión", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);
    const creados = (model: string) => calls.filter((c) => c.model === model && (c.method === "create" || c.method === "createMany"));

    expect(creados("cuota").map((c) => c.args.data.estado).sort()).toEqual(["VENCIDA", "VIGENTE"]);
    expect(creados("asistencia").length).toBeGreaterThan(0);
    expect(creados("registroDeProgreso").length).toBeGreaterThan(0);
    expect(creados("pago").length).toBeGreaterThan(0);
    expect(creados("sesionDeEntrenamiento").length).toBeGreaterThan(0);
    expect(creados("rutinaAsignada").every((c) => c.args.data.activa === true)).toBe(true);
  });

  it("P-24: el socio2 queda con la cuenta AL_DIA; el atraso es del PAGO calculado, no de la cuenta", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    // La cuenta es la decisión humana (D-46): nunca se escribe un estado de pago (VENCIDA/PENDIENTE).
    const estadosDeCuenta = calls
      .filter((c) => c.model === "socio")
      .flatMap((c) => [c.args.data?.estadoCuota, c.args.create?.estadoCuota])
      .filter(Boolean);
    expect(estadosDeCuenta).not.toContain("VENCIDA");
    expect(estadosDeCuenta).not.toContain("PENDIENTE");

    // El socio2 conserva una cuota con el vencimiento en el pasado (alerta de Home_Interno)…
    const cuotas = calls.filter((c) => c.model === "cuota" && c.method === "create");
    const cuotaAtrasada = cuotas.find((c) => c.args.data.fechaVencimiento.getTime() < NOW.getTime());
    expect(cuotaAtrasada).toBeDefined();

    // …y el estado de pago calculado (D-40) la marca VENCIDA una vez pasado el día límite.
    const periodo = periodoDe(cuotaAtrasada!.args.data.fechaVencimiento);
    const vencida = estadoCuotaSocio({
      ultimoPeriodoCubierto: periodo,
      hoy: new Date("2026-10-11T10:00:00-03:00"),
      diaLimite: 10,
      gracia: 0,
    });
    expect(vencida).toBe("VENCIDA");
  });

  it("siembra rutinas nuevas con sus ejercicios para probar el tracking", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const rutinas = calls
      .filter((c) => c.model === "rutina" && c.method === "create")
      .map((c) => c.args.data.nombre);
    expect(rutinas).toEqual(expect.arrayContaining(["Fuerza A", "Piernas", "Torso B", "Piernas B"]));

    const ejercicios = calls
      .filter((c) => c.model === "ejercicio" && c.method === "create")
      .map((c) => c.args.data.nombre);
    expect(ejercicios).toEqual(
      expect.arrayContaining(["Press inclinado", "Jalón al pecho", "Prensa de piernas", "Curl femoral"])
    );
  });

  it("enlaza los ejercicios nuevos con la media del catálogo (T-050f)", async () => {
    const { prisma, calls } = fakePrisma({
      "ejercicio.findUnique": { mediaId: "0047-3TZduzM", musculoObjetivo: "Pectorales", instrucciones: ["Paso"] },
    });
    await run(prisma);

    const creados = calls.filter((c) => c.model === "ejercicio" && c.method === "create");
    const conMedia = creados.filter((c) => c.args.data.mediaId);
    expect(conMedia).toHaveLength(8);
    for (const c of conMedia) {
      expect(c.args.data).toMatchObject({
        mediaId: "0047-3TZduzM",
        musculoObjetivo: "Pectorales",
        instrucciones: ["Paso"],
      });
    }
  });

  it("completa la media de un ejercicio del seed que ya existía sin ella", async () => {
    const { prisma, calls } = fakePrisma({
      "ejercicio.findFirst": { id: "ya-existe" },
      "ejercicio.findUnique": { mediaId: "0334-DsgkuIt", musculoObjetivo: "Deltoides", instrucciones: ["Paso"] },
    });
    await run(prisma);

    const updates = calls.filter((c) => c.model === "ejercicio" && c.method === "update");
    expect(updates).toHaveLength(8);
    expect(updates[0].args.data).toMatchObject({
      mediaId: "0334-DsgkuIt",
      musculoObjetivo: "Deltoides",
      instrucciones: ["Paso"],
    });
    expect(calls.filter((c) => c.model === "ejercicio" && c.method === "create")).toHaveLength(0);
  });

  it("refresca la media cuando el catálogo cambió (T-050g)", async () => {
    const { prisma, calls } = fakePrisma({
      "ejercicio.findFirst": {
        id: "ya-existe",
        mediaId: "viejo",
        musculoObjetivo: "Pecho",
        instrucciones: ["Túmbate en el suelo."],
      },
      "ejercicio.findUnique": { mediaId: "0334-DsgkuIt", musculoObjetivo: "Deltoides", instrucciones: ["Acostate en el piso."] },
    });
    await run(prisma);

    const updates = calls.filter((c) => c.model === "ejercicio" && c.method === "update");
    expect(updates).toHaveLength(8);
    expect(updates[0].args.data).toMatchObject({
      mediaId: "0334-DsgkuIt",
      musculoObjetivo: "Deltoides",
      instrucciones: ["Acostate en el piso."],
    });
  });

  it("deja Torso B activa, desactivando la asignación anterior del socio 1", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const desactivadas = calls.filter((c) => c.model === "rutinaAsignada" && c.method === "updateMany");
    expect(desactivadas).toHaveLength(1);
    expect(desactivadas[0].args).toMatchObject({ where: { activa: true }, data: { activa: false } });

    const activas = calls.filter(
      (c) =>
        c.model === "rutinaAsignada" &&
        (c.method === "create" || c.method === "update") &&
        c.args.data?.activa === true
    );
    expect(activas.length).toBeGreaterThan(0);
  });

  it("carga historial por serie con los cuatro tipos de serie (D-64/D-69)", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const filas = calls
      .filter((c) => c.model === "registroDeProgreso" && c.method === "createMany")
      .flatMap((c) => c.args.data);

    expect(new Set(filas.map((f) => f.tipo))).toEqual(
      new Set(["NORMAL", "CALENTAMIENTO", "HASTA_EL_FALLO", "DROP_SET"])
    );

    const conSesion = filas.filter((f) => f.sesionId);
    expect(conSesion.length).toBeGreaterThan(30);
    for (const f of conSesion.filter((x) => x.tipo !== "CALENTAMIENTO")) {
      expect(Number.isInteger(f.numeroSerie)).toBe(true);
      expect(f.numeroSerie).toBeGreaterThanOrEqual(1);
    }
    expect(conSesion.filter((f) => f.tipo === "CALENTAMIENTO").every((f) => f.numeroSerie === null)).toBe(true);
    expect(filas.some((f) => f.tipo === "HASTA_EL_FALLO" && f.rir === 0)).toBe(true);
  });

  it("siembra pesajes y meta de peso, y los borra al re-sembrar (T-048)", async () => {
    const { prisma, calls } = fakePrisma();
    await run(prisma);

    const pesajes = calls
      .filter((c) => c.model === "medicionDePeso" && c.method === "createMany")
      .flatMap((c) => c.args.data);
    expect(pesajes.length).toBeGreaterThanOrEqual(4);
    expect(pesajes.every((p) => p.socioId && typeof p.peso === "number" && p.fecha instanceof Date)).toBe(true);

    const meta = calls.find(
      (c) => c.model === "socio" && c.method === "update" && "pesoObjetivo" in c.args.data
    );
    expect(meta?.args.data).toMatchObject({
      pesoObjetivo: expect.any(Number),
      pesoInicialDeMeta: expect.any(Number),
    });

    const borrado = calls.find((c) => c.model === "medicionDePeso" && c.method === "deleteMany");
    expect(borrado?.args.where.socioId.in).toHaveLength(2);
  });

  it("devuelve las credenciales sin hashes", async () => {
    const { prisma } = fakePrisma();
    const res = await run(prisma);

    expect(res.password).toBe("Secreta123!");
    expect(res.usuarios).toHaveLength(5);
    expect(res.usuarios.map((u) => u.rol)).toEqual(
      expect.arrayContaining(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA", "SOCIO"])
    );
    expect(JSON.stringify(res)).not.toContain("hashed:");
  });
});
