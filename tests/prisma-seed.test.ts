import { runSeed, SEED_EMAIL_DOMAIN } from "../prisma/seed-data";

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
