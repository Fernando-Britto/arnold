import { prisma } from "@/lib/db";
import { asignacionRepository } from "@/domains/asignacion/asignacion-repositorio";
import { calcularEspera } from "@/domains/asignacion/motor-espera";
import { AHORA, crearEscenario, limpiar, lectura } from "./asignacion-fixtures";

describe("AsignacionRepository: concurrencia contra Postgres real", () => {
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

  it("dos cálculos simultáneos no eligen la misma máquina libre", async () => {
    const a = await crearEscenario({ nombre: "Olga", maquinas: 2 });
    const b = await crearEscenario({ nombre: "Paco", maquinas: 2 });
    // Ambos ejercicios comparten las cuatro máquinas. `crearEscenario` ya asoció cada ejercicio con
    // las suyas, así que acá solo se agregan las asociaciones cruzadas (las propias chocarían con
    // `@@unique([maquinaId, ejercicioId])`).
    for (const maquinaId of a.maquinaIds) {
      await prisma.ejercicioMaquina.create({
        data: { ejercicioId: b.ejercicioId, maquinaId },
      });
    }
    for (const maquinaId of b.maquinaIds) {
      await prisma.ejercicioMaquina.create({
        data: { ejercicioId: a.ejercicioId, maquinaId },
      });
    }

    const reservar = async (socioId: string) =>
      asignacionRepository.enTransaccionBloqueada(async (tx) => {
        const leida = await tx.leerEntradaMotor(lectura(socioId));
        if (!leida) throw new Error("sin rutina");
        const resultado = calcularEspera(leida.entrada);
        if (resultado.tipo !== "exito") throw new Error(`resultado ${resultado.tipo}`);
        await tx.cancelarReservasActivas(socioId, AHORA);
        return tx.crearReserva({
          socioId,
          ejercicioId: resultado.recomendado.ejercicioId,
          maquinaId: resultado.recomendado.maquinaId ?? "",
          esperaSegundos: resultado.recomendado.espera,
          ahorroSegundos: resultado.ahorro,
          creadaEn: AHORA,
          venceEn: new Date("2026-10-26T10:15:00.000Z"),
        });
      });

    const [reservaA, reservaB] = await Promise.all([reservar(a.socioId), reservar(b.socioId)]);

    const filas = await prisma.asignacionDeEjercicio.findMany({
      where: { id: { in: [reservaA.id, reservaB.id] } },
      select: { maquinaId: true },
    });
    expect(filas).toHaveLength(2);
    expect(filas[0].maquinaId).not.toBe(filas[1].maquinaId);
  });

  it("el advisory lock se libera cuando la transacción falla", async () => {
    await expect(
      asignacionRepository.enTransaccionBloqueada(async () => {
        throw new Error("falla deliberada");
      })
    ).rejects.toThrow("falla deliberada");

    // Si el lock hubiera quedado tomado, esta segunda transacción se bloquearía hasta el timeout.
    const resultado = await asignacionRepository.enTransaccionBloqueada(async () => "libre");
    expect(resultado).toBe("libre");
  }, 15_000);
});
