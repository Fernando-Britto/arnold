import { prisma } from "@/lib/db";
import { reasignacionPuerto } from "@/domains/asignacion/asignacion-repositorio";
import { reasignarMaquina } from "@/domains/asignacion/reasignacion";
import { AHORA, crearEscenario, limpiar } from "./asignacion-fixtures";

/**
 * P-61 contra Postgres real: lock global, transacción y transición EN_CURSO → CANCELADA.
 *
 * Se ejecuta con `npm run test:integration` (Docker). No corre en `npm test`.
 * MUTACIÓN: quitar `enTransaccionDeReasignacion` (o el advisory lock) hace fallar el test de
 * concurrencia: dos reasignaciones a la misma máquina podrían quedar las dos EN_CURSO.
 */
const responsables: string[] = [];

async function limpiarTodo(): Promise<void> {
  if (responsables.length > 0) {
    await prisma.registroDeAuditoria.deleteMany({ where: { responsableId: { in: responsables } } });
    responsables.length = 0;
  }
  await limpiar();
}

/** Crea sesión EN_CURSO y su fila de ejecución en la máquina indicada. */
async function iniciarEjecucion(escenario: {
  socioId: string;
  rutinaAsignadaId: string;
  ejercicioId: string;
}, maquinaId: string) {
  const sesion = await prisma.sesionDeEntrenamiento.create({
    data: {
      socioId: escenario.socioId,
      rutinaAsignadaId: escenario.rutinaAsignadaId,
      estadoDeFinalizacion: "EN_CURSO",
      horaInicio: AHORA,
      ejercicioActualId: escenario.ejercicioId,
      serieActual: 1,
    },
    select: { id: true },
  });
  const asignacion = await prisma.asignacionDeEjercicio.create({
    data: {
      socioId: escenario.socioId,
      sesionId: sesion.id,
      ejercicioId: escenario.ejercicioId,
      maquinaId,
      estado: "EN_CURSO",
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: AHORA,
      venceEn: AHORA,
    },
    select: { id: true },
  });
  return { sesionId: sesion.id, asignacionId: asignacion.id };
}

const reasignar = (asignacionId: string, maquinaId: string, responsableId: string) =>
  reasignarMaquina(
    { asignacionId, maquinaDestinoId: maquinaId, responsableId, ahora: AHORA },
    reasignacionPuerto
  );

describe("reasignación por instructor contra Postgres real", () => {
  beforeAll(async () => {
    const filas = await prisma.$queryRaw<{ db: string }[]>/*sql*/ `SELECT current_database() AS db`;
    if (filas[0]?.db !== "arnold_test") {
      throw new Error(
        `La suite de integración solo corre contra la base de prueba (arnold_test); conectada a: ${filas[0]?.db}`
      );
    }
  });

  beforeEach(limpiarTodo);
  afterAll(async () => {
    await limpiarTodo();
    await prisma.$disconnect();
  });

  it("cancela la fila EN_CURSO y crea la nueva en la misma sesión, con auditoría", async () => {
    const escenario = await crearEscenario({ nombre: "Ines", maquinas: 2 });
    responsables.push(escenario.usuarioId);
    const { asignacionId, sesionId } = await iniciarEjecucion(escenario, escenario.maquinaIds[0]);

    const resultado = await reasignar(asignacionId, escenario.maquinaIds[1], escenario.usuarioId);

    expect(resultado).toMatchObject({ tipo: "ok", maquinaId: escenario.maquinaIds[1] });

    const filas = await prisma.asignacionDeEjercicio.findMany({
      where: { sesionId },
      orderBy: { creadaEn: "asc" },
      select: { id: true, estado: true, maquinaId: true, ejercicioId: true },
    });
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ id: asignacionId, estado: "CANCELADA", maquinaId: escenario.maquinaIds[0] });
    expect(filas[1]).toMatchObject({ estado: "EN_CURSO", maquinaId: escenario.maquinaIds[1] });
    expect(filas[1].ejercicioId).toBe(escenario.ejercicioId);

    const sesion = await prisma.sesionDeEntrenamiento.findUnique({
      where: { id: sesionId },
      select: { estadoDeFinalizacion: true, ejercicioActualId: true },
    });
    expect(sesion).toEqual({ estadoDeFinalizacion: "EN_CURSO", ejercicioActualId: escenario.ejercicioId });

    const auditoria = await prisma.registroDeAuditoria.findMany({
      where: { responsableId: escenario.usuarioId, tipoOperacion: "MODIFICACION" },
      select: { detalles: true },
    });
    expect(auditoria).toHaveLength(1);
    expect(JSON.parse(auditoria[0].detalles ?? "{}")).toMatchObject({
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      asignacionOrigenId: asignacionId,
      maquinaOrigenId: escenario.maquinaIds[0],
      maquinaDestinoId: escenario.maquinaIds[1],
    });
  });

  it("una fila que el socio ya completó no se reasigna", async () => {
    const escenario = await crearEscenario({ nombre: "Juli", maquinas: 2 });
    responsables.push(escenario.usuarioId);
    const { asignacionId } = await iniciarEjecucion(escenario, escenario.maquinaIds[0]);
    await prisma.asignacionDeEjercicio.updateMany({
      where: { id: asignacionId },
      data: { estado: "COMPLETADA" },
    });

    const resultado = await reasignar(asignacionId, escenario.maquinaIds[1], escenario.usuarioId);

    expect(resultado).toEqual({ tipo: "error", codigo: "ASIGNACION_NO_ENCONTRADA" });
    const filas = await prisma.asignacionDeEjercicio.count({ where: { id: asignacionId, estado: "COMPLETADA" } });
    expect(filas).toBe(1);
  });

  it("rechaza una máquina ocupada por otro socio con actividad vigente", async () => {
    const a = await crearEscenario({ nombre: "Lola", maquinas: 2 });
    const b = await crearEscenario({ nombre: "Mario", maquinas: 1 });
    responsables.push(a.usuarioId, b.usuarioId);
    // La máquina de B también es candidata del ejercicio de A.
    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: a.ejercicioId, maquinaId: b.maquinaIds[0] },
    });
    const { asignacionId } = await iniciarEjecucion(a, a.maquinaIds[0]);
    await iniciarEjecucion(b, b.maquinaIds[0]);

    const resultado = await reasignar(asignacionId, b.maquinaIds[0], a.usuarioId);

    expect(resultado).toEqual({ tipo: "error", codigo: "MAQUINA_OCUPADA" });
  });

  it("dos reasignaciones simultáneas a la misma máquina: una gana (lock global)", async () => {
    const a = await crearEscenario({ nombre: "Nora", maquinas: 2 });
    const b = await crearEscenario({ nombre: "Oscar", maquinas: 2 });
    responsables.push(a.usuarioId, b.usuarioId);

    // `a.maquinaIds[1]` es candidata de ambos ejercicios: es el destino compartido.
    const compartida = a.maquinaIds[1];
    await prisma.ejercicioMaquina.create({ data: { ejercicioId: b.ejercicioId, maquinaId: compartida } });

    const { asignacionId: asignacionA } = await iniciarEjecucion(a, a.maquinaIds[0]);
    const { asignacionId: asignacionB } = await iniciarEjecucion(b, b.maquinaIds[0]);

    const [resA, resB] = await Promise.all([
      reasignar(asignacionA, compartida, a.usuarioId),
      reasignar(asignacionB, compartida, b.usuarioId),
    ]);

    const resultados = [resA, resB];
    expect(resultados.filter((r) => r.tipo === "ok")).toHaveLength(1);
    expect(resultados.filter((r) => r.tipo === "error" && r.codigo === "MAQUINA_OCUPADA")).toHaveLength(1);

    const enCurso = await prisma.asignacionDeEjercicio.count({
      where: { maquinaId: compartida, estado: "EN_CURSO" },
    });
    expect(enCurso).toBe(1);
  });
});

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Prueba directa de serialización: la transacción A retiene el lock dentro de su callback (barrera que
 * controla el test) y B no puede entrar hasta que A termine. Sin el advisory lock, B corre de inmediato y
 * este test falla — es el que detecta la mutación, no el de estado final.
 */
describe("lock global de la reasignación", () => {
  it("serializa dos transacciones de reasignación", async () => {
    let liberarA!: () => void;
    const barreraA = new Promise<void>((resolver) => {
      liberarA = resolver;
    });
    let marcarA!: () => void;
    const entroA = new Promise<void>((resolver) => {
      marcarA = resolver;
    });
    let bCorrio = false;

    const a = reasignacionPuerto.enTransaccionBloqueada(async () => {
      marcarA();
      await barreraA;
      return "A";
    });

    await entroA; // A ya tiene el lock

    const b = reasignacionPuerto.enTransaccionBloqueada(async () => {
      bCorrio = true;
      return "B";
    });

    // Con lock, B queda esperando en Postgres; sin lock, corre enseguida.
    await esperar(250);
    const corrioAntesDeLiberar = bCorrio;

    liberarA();
    await Promise.all([a, b]);

    expect(corrioAntesDeLiberar).toBe(false);
    expect(bCorrio).toBe(true);
  });
});
