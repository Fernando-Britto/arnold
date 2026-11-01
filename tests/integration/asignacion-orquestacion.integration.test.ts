import { prisma } from "@/lib/db";
import { asignacionRepository } from "@/domains/asignacion/asignacion-repositorio";
import type { AsignacionPort } from "@/domains/asignacion/asignacion-puerto";
import { calcularYReservar } from "@/domains/asignacion/orquestacion";
import { AHORA, crearEscenario, limpiar } from "./asignacion-fixtures";

/** Barrera de dos participantes con tope: si el otro no llega, sigue. */
function barreraDeDos(topeMs: number) {
  let llegados = 0;
  let liberar: () => void = () => {};
  const ambos = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  return {
    async esperar(): Promise<void> {
      llegados += 1;
      if (llegados >= 2) {
        liberar();
        return;
      }
      await Promise.race([ambos, new Promise<void>((resolve) => setTimeout(resolve, topeMs))]);
    },
  };
}

/** Envuelve el puerto para que `leerEntradaMotor` pase por la barrera. Sin lock, las dos leen juntas. */
function conBarreraDeLectura(barrera: { esperar: () => Promise<void> }): AsignacionPort {
  const interceptar = (objeto: object) =>
    new Proxy(objeto, {
      get(objetivo, propiedad) {
        const original = Reflect.get(objetivo, propiedad, objetivo);
        if (propiedad === "leerEntradaMotor" && typeof original === "function") {
          return async (lectura: unknown) => {
            await barrera.esperar();
            return (original as (l: unknown) => Promise<unknown>).call(objetivo, lectura);
          };
        }
        return typeof original === "function" ? original.bind(objetivo) : original;
      },
    });

  return new Proxy(asignacionRepository, {
    get(objetivo, propiedad) {
      if (propiedad === "enTransaccionBloqueada") {
        return (fn: (tx: object) => Promise<unknown>, opciones?: { maxWait?: number; timeout?: number }) =>
          objetivo.enTransaccionBloqueada((tx) => fn(interceptar(tx)), opciones);
      }
      const original = Reflect.get(objetivo, propiedad, objetivo);
      return typeof original === "function" ? original.bind(objetivo) : original;
    },
  }) as unknown as AsignacionPort;
}

describe("Orquestación contra Postgres real", () => {
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

  it("dos check-in concurrentes sobre M1: una reserva por socio y una sola espera > 0", async () => {
    const a = await crearEscenario({ nombre: "Quique", maquinas: 1 });
    const b = await crearEscenario({ nombre: "Rita", maquinas: 1 });
    const repositorio = conBarreraDeLectura(barreraDeDos(300));

    // Los dos ejercicios compiten por la MISMA máquina: se quita la propia de B y se asocia la de A.
    await prisma.ejercicioMaquina.deleteMany({ where: { maquinaId: b.maquinaIds[0] } });
    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: b.ejercicioId, maquinaId: a.maquinaIds[0] },
    });

    const [primera, segunda] = await Promise.all([
      calcularYReservar({ socioId: a.socioId, ahora: AHORA, momento: "CHECK_IN" }, { repositorio }),
      calcularYReservar({ socioId: b.socioId, ahora: AHORA, momento: "CHECK_IN" }, { repositorio }),
    ]);

    expect(primera.tipo).toBe("reservada");
    expect(segunda.tipo).toBe("reservada");

    const esperas = [primera, segunda].map((resultado) =>
      resultado.tipo === "reservada" ? resultado.esperaSegundos : -1
    );
    expect(esperas.filter((espera) => espera === 0)).toHaveLength(1);
    expect(esperas.filter((espera) => espera > 0)).toHaveLength(1);

    const filas = await prisma.asignacionDeEjercicio.findMany({
      where: { estado: "RESERVADA" },
      orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
    });
    expect(filas).toHaveLength(2);
    expect(new Set(filas.map((fila) => fila.socioId)).size).toBe(2);
    expect(filas.every((fila) => fila.maquinaId === a.maquinaIds[0])).toBe(true);
  });

  it("dos recálculos del mismo socio dejan una sola reserva activa", async () => {
    const a = await crearEscenario({ nombre: "Sonia", maquinas: 1 });

    await Promise.all([
      calcularYReservar({ socioId: a.socioId, ahora: AHORA, momento: "CHECK_IN" }),
      calcularYReservar({ socioId: a.socioId, ahora: AHORA, momento: "INICIO_RUTINA" }),
    ]);

    const filas = await prisma.asignacionDeEjercicio.findMany({
      where: { socioId: a.socioId },
      orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
    });
    expect(filas).toHaveLength(2);
    expect(filas.filter((fila) => fila.estado === "RESERVADA")).toHaveLength(1);
    expect(filas.filter((fila) => fila.estado === "CANCELADA")).toHaveLength(1);
  });

  it("cancelar y lanzar dentro de la transacción revierte la cancelación", async () => {
    const a = await crearEscenario({ nombre: "Tina", maquinas: 1 });
    const reserva = await calcularYReservar({
      socioId: a.socioId,
      ahora: AHORA,
      momento: "CHECK_IN",
    });
    expect(reserva.tipo).toBe("reservada");

    await expect(
      asignacionRepository.enTransaccionBloqueada(async (tx) => {
        await tx.cancelarReservasActivas(a.socioId, AHORA);
        throw new Error("falla deliberada");
      })
    ).rejects.toThrow("falla deliberada");

    const asignacionId = reserva.tipo === "reservada" ? reserva.asignacionId : "";
    const fila = await prisma.asignacionDeEjercicio.findUniqueOrThrow({
      where: { id: asignacionId },
    });
    expect(fila.estado).toBe("RESERVADA");
    expect(await prisma.asignacionDeEjercicio.count({ where: { socioId: a.socioId } })).toBe(1);
  }, 15_000);
});
