import { prisma } from "@/lib/db";
import { ejercicioRepository } from "@/domains/ejercicio/ejercicio-repositorio";
import { maquinaRepository } from "@/domains/maquina/maquina-repositorio";

/** Crea una rutina real y le ata el ejercicio (bloquea el delete por la FK Restrict). */
async function crearRutinaConEjercicio(ejercicioId: string) {
  await prisma.rutina.create({
    data: {
      nombre: "Rutina de fuerza",
      objetivoPrincipal: "Fuerza",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
      ejercicios: { create: { ejercicioId, series: 3, repeticiones: 10, descanso: 60 } },
    },
  });
}

async function crearMaquina(nombre = "Polea alta") {
  return prisma.maquina.create({
    data: { nombre, ubicacion: "Sala principal", tipoEquipamiento: "MAQUINA_GUIADA" },
  });
}

const crearEjercicio = (nombre: string, grupoMuscular = "Pecho") =>
  prisma.ejercicio.create({ data: { nombre, grupoMuscular } });

describe("EjercicioMaquina contra Postgres real", () => {
  beforeAll(async () => {
    // Guarda de seguridad: esta suite borra filas, así que sólo puede apuntar a la base de prueba.
    const filas = await prisma.$queryRaw<{ db: string }[]>/*sql*/ `SELECT current_database() AS db`;
    if (filas[0]?.db !== "arnold_test") {
      throw new Error(
        `La suite de integración solo corre contra la base de prueba (arnold_test); conectada a: ${filas[0]?.db}`
      );
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Sólo las tablas que usa esta suite, hijas antes que padres.
    await prisma.ejercicioMaquina.deleteMany();
    await prisma.registroDeProgreso.deleteMany();
    await prisma.ejercicioEnRutina.deleteMany();
    await prisma.ejercicio.deleteMany();
    await prisma.rutina.deleteMany();
    await prisma.maquina.deleteMany();
  });

  it("rechaza el par (maquinaId, ejercicioId) duplicado con P2002", async () => {
    const maquina = await crearMaquina();
    const ejercicio = await crearEjercicio("Press banca");
    const data = { maquinaId: maquina.id, ejercicioId: ejercicio.id };

    await prisma.ejercicioMaquina.create({ data });

    await expect(prisma.ejercicioMaquina.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("borrar el ejercicio sin rutinas ni progreso elimina sus filas (Cascade)", async () => {
    const maquina = await crearMaquina();
    const ejercicio = await crearEjercicio("Curl");
    await prisma.ejercicioMaquina.create({
      data: { maquinaId: maquina.id, ejercicioId: ejercicio.id },
    });

    await expect(ejercicioRepository.delete(ejercicio.id)).resolves.toBe(true);

    expect(
      await prisma.ejercicioMaquina.count({ where: { ejercicioId: ejercicio.id } })
    ).toBe(0);
  });

  it("un ejercicio en una rutina sigue bloqueado y conserva su asociación a la máquina", async () => {
    const maquina = await crearMaquina();
    const ejercicio = await crearEjercicio("Remo con barra", "Espalda");
    await crearRutinaConEjercicio(ejercicio.id);
    await prisma.ejercicioMaquina.create({
      data: { maquinaId: maquina.id, ejercicioId: ejercicio.id },
    });

    await expect(ejercicioRepository.delete(ejercicio.id)).rejects.toMatchObject({
      code: "DELETE_BLOCKED_ASSIGNED",
    });

    expect(await prisma.ejercicio.findUnique({ where: { id: ejercicio.id } })).not.toBeNull();
    expect(
      await prisma.ejercicioMaquina.count({ where: { ejercicioId: ejercicio.id } })
    ).toBe(1);
  });

  it("borrar la máquina elimina sus asociaciones (Cascade)", async () => {
    const maquina = await crearMaquina();
    const ejercicio = await crearEjercicio("Sentadilla", "Piernas");
    await prisma.ejercicioMaquina.create({
      data: { maquinaId: maquina.id, ejercicioId: ejercicio.id },
    });

    // Borrado directo por Prisma: el handler bloquea antes (T-054g); aquí se prueba la FK.
    await prisma.maquina.delete({ where: { id: maquina.id } });

    expect(
      await prisma.ejercicioMaquina.count({ where: { maquinaId: maquina.id } })
    ).toBe(0);
  });

  it("reemplazarEjerciciosAsociados reemplaza el conjunto de forma atómica", async () => {
    const maquina = await crearMaquina();
    const e1 = await crearEjercicio("Press banca");
    const e2 = await crearEjercicio("Sentadilla", "Piernas");
    const e3 = await crearEjercicio("Zancada", "Piernas");
    await prisma.ejercicioMaquina.createMany({
      data: [
        { maquinaId: maquina.id, ejercicioId: e1.id },
        { maquinaId: maquina.id, ejercicioId: e2.id },
      ],
    });

    const resultado = await maquinaRepository.reemplazarEjerciciosAsociados(maquina.id, [
      e2.id,
      e3.id,
    ]);

    expect(resultado.map((e) => e.id).sort()).toEqual([e2.id, e3.id].sort());

    const filas = await prisma.ejercicioMaquina.findMany({
      where: { maquinaId: maquina.id },
      select: { ejercicioId: true },
    });
    expect(filas.map((f) => f.ejercicioId).sort()).toEqual([e2.id, e3.id].sort());

    // El reemplazo vacío deja la máquina sin asociaciones.
    await expect(
      maquinaRepository.reemplazarEjerciciosAsociados(maquina.id, [])
    ).resolves.toEqual([]);
    expect(
      await prisma.ejercicioMaquina.count({ where: { maquinaId: maquina.id } })
    ).toBe(0);
  });

  it("el conteo y la lectura devuelven el total real y el orden por nombre", async () => {
    const maquina = await crearMaquina();
    const abductores = await crearEjercicio("Abductores", "Piernas");
    const press = await crearEjercicio("Press banca", "Pecho");
    const zancada = await crearEjercicio("Zancada", "Piernas");

    await maquinaRepository.reemplazarEjerciciosAsociados(maquina.id, [
      zancada.id,
      abductores.id,
      press.id,
    ]);

    expect(await maquinaRepository.contarEjerciciosAsociados(maquina.id)).toBe(3);
    expect(await maquinaRepository.getEjerciciosAsociados(maquina.id)).toEqual([
      { id: abductores.id, nombre: "Abductores", grupoMuscular: "Piernas" },
      { id: press.id, nombre: "Press banca", grupoMuscular: "Pecho" },
      { id: zancada.id, nombre: "Zancada", grupoMuscular: "Piernas" },
    ]);
  });
});
