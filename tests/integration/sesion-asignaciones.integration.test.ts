import { prisma } from "@/lib/db";
import { evaluarYRegistrarAcceso, type SocioParaAcceso } from "@/api/acceso";
import {
  finalizarSesion,
  iniciarSesion,
  registrarSerie,
} from "@/domains/sesion/sesion-de-entrenamiento";
import {
  agregarEjercicioARutina,
  AHORA,
  crearEscenario,
  limpiar,
} from "./asignacion-fixtures";

/**
 * Flujo real de sesión contra Postgres: check-in → reserva → inicio → avance → fin.
 * Sin mocks de Prisma ni de la orquestación. El tiempo se controla con el `ahora` inyectable.
 */

const ACCESO = {
  ip: "127.0.0.1",
  userAgent: "test-integración",
  metodo: "DNI_PIN" as const,
};

function socioParaAcceso(socioId: string): SocioParaAcceso {
  return {
    id: socioId,
    estadoCuota: "AL_DIA",
    usuario: { nombre: "Socio de prueba" },
    membresiaAsignada: null,
  };
}

/** Cuota que cubre el mes de `AHORA`, requisito para un check-in PERMITIDO. */
async function crearCuotaVigente(socioId: string): Promise<void> {
  await prisma.cuota.create({
    data: { socioId, fechaVencimiento: new Date("2026-10-31T00:00:00.000Z") },
  });
}

const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);

describe("Flujo de sesión con asignaciones contra Postgres real", () => {
  beforeAll(async () => {
    const filas = await prisma.$queryRaw<{ db: string }[]>/*sql*/ `SELECT current_database() AS db`;
    if (filas[0]?.db !== "arnold_test") {
      throw new Error(
        `La suite de integración solo corre contra la base de prueba (arnold_test); conectada a: ${filas[0]?.db}`
      );
    }
  });

  beforeEach(limpiar);
  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  });

  it("check-in, inicio, avance por orden y fin de sesión", async () => {
    const escenario = await crearEscenario({ nombre: "Silvia", maquinas: 1, series: 1 });
    const segundo = await agregarEjercicioARutina(escenario, {
      nombre: "Remo",
      maquinas: 1,
      series: 1,
      orden: 2,
    });
    await crearCuotaVigente(escenario.socioId);

    // a) check-in permitido → reserva provisional
    await evaluarYRegistrarAcceso(
      prisma as unknown as Parameters<typeof evaluarYRegistrarAcceso>[0],
      socioParaAcceso(escenario.socioId),
      { ...ACCESO, ahora: AHORA }
    );

    const reservas = await prisma.asignacionDeEjercicio.findMany({
      where: { socioId: escenario.socioId, estado: "RESERVADA" },
    });
    expect(reservas).toHaveLength(1);
    const reserva = reservas[0];
    expect(reserva.maquinaId).not.toBeNull();

    // b) iniciar sesión → consume la reserva
    const { sesion } = await iniciarSesion({
      socioId: escenario.socioId,
      rutinaAsignadaId: escenario.rutinaAsignadaId,
      ahora: minutos(1),
    });
    const sesionId = (sesion as { id: string }).id;

    const consumida = await prisma.asignacionDeEjercicio.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(consumida.estado).toBe("EN_CURSO");
    expect(consumida.sesionId).toBe(sesionId);

    const guardada = await prisma.sesionDeEntrenamiento.findUniqueOrThrow({
      where: { id: sesionId },
    });
    expect(guardada.ejercicioActualId).toBe(reserva.ejercicioId);

    const enCursoDeLaSesion = await prisma.asignacionDeEjercicio.findMany({
      where: { sesionId, estado: "EN_CURSO" },
    });
    expect(enCursoDeLaSesion).toHaveLength(1);
    expect(enCursoDeLaSesion[0].ejercicioId).toBe(reserva.ejercicioId);

    // c) última serie (el ejercicio tiene una) → completa y avanza
    await registrarSerie({
      sesionId,
      ejercicioId: reserva.ejercicioId,
      carga: 40,
      repeticiones: 10,
      ahora: minutos(2),
    });

    const completada = await prisma.asignacionDeEjercicio.findFirstOrThrow({
      where: { sesionId, ejercicioId: reserva.ejercicioId },
    });
    expect(completada.estado).toBe("COMPLETADA");

    const avanzada = await prisma.sesionDeEntrenamiento.findUniqueOrThrow({
      where: { id: sesionId },
    });
    const esperadoSiguiente =
      reserva.ejercicioId === escenario.ejercicioId ? segundo.ejercicioId : escenario.ejercicioId;
    expect(avanzada.ejercicioActualId).toBe(esperadoSiguiente);

    // d) fin de sesión → ninguna fila EN_CURSO
    await finalizarSesion({ sesionId, ahora: minutos(3) });
    const enCursoAlFinal = await prisma.asignacionDeEjercicio.count({
      where: { sesionId, estado: "EN_CURSO" },
    });
    expect(enCursoAlFinal).toBe(0);
  }, 30_000);

  it("sin reserva, el inicio crea la fila EN_CURSO con la máquina única", async () => {
    const escenario = await crearEscenario({ nombre: "Tadeo", maquinas: 1 });

    const { sesion } = await iniciarSesion({
      socioId: escenario.socioId,
      rutinaAsignadaId: escenario.rutinaAsignadaId,
      ahora: AHORA,
    });
    const sesionId = (sesion as { id: string }).id;

    const filas = await prisma.asignacionDeEjercicio.findMany({ where: { sesionId } });
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe("EN_CURSO");
    expect(filas[0].ejercicioId).toBe(escenario.ejercicioId);
    expect(filas[0].maquinaId).toBe(escenario.maquinaIds[0]);
    expect(filas[0].esperaSegundos).toBe(0);
    expect(filas[0].ahorroSegundos).toBe(0);
  }, 30_000);

  it("sin reserva, con varias candidatas la fila queda sin máquina", async () => {
    const escenario = await crearEscenario({ nombre: "Ulises", maquinas: 2 });

    const { sesion } = await iniciarSesion({
      socioId: escenario.socioId,
      rutinaAsignadaId: escenario.rutinaAsignadaId,
      ahora: AHORA,
    });
    const sesionId = (sesion as { id: string }).id;

    const filas = await prisma.asignacionDeEjercicio.findMany({ where: { sesionId } });
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe("EN_CURSO");
    expect(filas[0].maquinaId).toBeNull();
  }, 30_000);
});
