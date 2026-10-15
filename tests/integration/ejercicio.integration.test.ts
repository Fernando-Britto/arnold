import { prisma } from "@/lib/db";
import { ejercicioRepository } from "@/domains/ejercicio/ejercicio-repositorio";
import { buildEjercicioEnRutina } from "../factories/ejercicio-en-rutina";
import { buildRutina } from "../factories/rutina";

// Estas factories son constructores puros con ids falsos: NUNCA se persisten tal cual.
// De la de EjercicioEnRutina sólo se toman los valores de campos; las FKs se pasan reales.

/** Crea una Rutina real en la base (los ids de la factory son falsos). */
async function crearRutina() {
  const valores = buildRutina();
  return prisma.rutina.create({
    data: {
      nombre: valores.nombre,
      objetivoPrincipal: valores.objetivoPrincipal,
      frecuenciaSemanal: valores.frecuenciaSemanal,
      duracionEstimada: valores.duracionEstimada,
      nivelDeDificultad: valores.nivelDeDificultad,
      descripcion: valores.descripcion,
    },
  });
}

/** Ata un ejercicio real a una rutina real con valores de la factory. */
async function crearEjercicioEnRutina(rutinaId: string, ejercicioId: string) {
  const valores = buildEjercicioEnRutina({ rutinaId, ejercicioId });
  return prisma.ejercicioEnRutina.create({
    data: {
      rutinaId,
      ejercicioId,
      series: valores.series,
      repeticiones: valores.repeticiones,
      descanso: valores.descanso,
      orden: valores.orden,
    },
  });
}

describe("EjercicioRepository contra Postgres real", () => {
  beforeAll(async () => {
    // Guarda de seguridad: esta suite borra filas, así que sólo puede apuntar a la base de prueba.
    const filas = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
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
    await prisma.registroDeProgreso.deleteMany();
    await prisma.ejercicioEnRutina.deleteMany();
    await prisma.ejercicio.deleteMany();
    await prisma.rutina.deleteMany();
  });

  it("create + getById hacen round-trip por la base real (id cuid y fechas reales)", async () => {
    const creado = await ejercicioRepository.create({
      nombre: "Press banca",
      grupoMuscular: "Pecho",
      descripcion: "Con barra",
    });

    // Un id real de cuid empieza con "c"; el mock generaba "ej-1".
    expect(creado.id).toMatch(/^c[a-z0-9]+$/);

    const leido = await ejercicioRepository.getById(creado.id);
    expect(leido).toEqual(creado);
    expect(leido?.createdAt).toBeInstanceOf(Date);
    expect(leido?.updatedAt).toBeInstanceOf(Date);
  });

  it("delete elimina de verdad la fila cuando no hay hijos", async () => {
    const creado = await ejercicioRepository.create({ nombre: "Curl", grupoMuscular: "Brazos" });

    await expect(ejercicioRepository.delete(creado.id)).resolves.toBe(true);

    expect(await ejercicioRepository.getById(creado.id)).toBeNull();
    // Comprobación directa en la base, sin pasar por el repositorio.
    expect(await prisma.ejercicio.findUnique({ where: { id: creado.id } })).toBeNull();
  });

  it("delete de un id inexistente resuelve false (P2025 real)", async () => {
    await expect(ejercicioRepository.delete("no-existe-este-id")).resolves.toBe(false);
  });

  it("delete rechaza con DELETE_BLOCKED_ASSIGNED cuando hay una fila hija real (P2003 real)", async () => {
    const ejercicio = await ejercicioRepository.create({
      nombre: "Remo con barra",
      grupoMuscular: "Espalda",
    });
    const rutina = await crearRutina();
    await crearEjercicioEnRutina(rutina.id, ejercicio.id);

    await expect(ejercicioRepository.delete(ejercicio.id)).rejects.toMatchObject({
      code: "DELETE_BLOCKED_ASSIGNED",
    });
  });

  it("control positivo: sin la fila hija, ese mismo ejercicio se puede borrar", async () => {
    const ejercicio = await ejercicioRepository.create({
      nombre: "Remo con barra",
      grupoMuscular: "Espalda",
    });
    const rutina = await crearRutina();
    await crearEjercicioEnRutina(rutina.id, ejercicio.id);

    // Se quita la hija y el bloqueo debe desaparecer: la FK era la causa.
    await prisma.ejercicioEnRutina.deleteMany({ where: { ejercicioId: ejercicio.id } });

    await expect(ejercicioRepository.delete(ejercicio.id)).resolves.toBe(true);
    expect(await ejercicioRepository.getById(ejercicio.id)).toBeNull();
  });

  it("getAll busca por nombre sin distinguir mayúsculas (real)", async () => {
    await ejercicioRepository.create({ nombre: "Press banca", grupoMuscular: "Pecho" });
    await ejercicioRepository.create({ nombre: "PRESS MILITAR", grupoMuscular: "Hombros" });
    await ejercicioRepository.create({ nombre: "Sentadilla", grupoMuscular: "Piernas" });

    const resultados = await ejercicioRepository.getAll({ search: "press" });

    const nombres = resultados.map((e) => e.nombre);
    expect(nombres).toHaveLength(2);
    expect(nombres).toEqual(expect.arrayContaining(["Press banca", "PRESS MILITAR"]));
  });

  it("getAll filtra por grupoMuscular exacto", async () => {
    await ejercicioRepository.create({ nombre: "Press banca", grupoMuscular: "Pecho" });
    await ejercicioRepository.create({ nombre: "Aperturas", grupoMuscular: "Pecho" });
    await ejercicioRepository.create({ nombre: "Sentadilla", grupoMuscular: "Piernas" });

    const resultados = await ejercicioRepository.getAll({ muscleGroup: "Pecho" });

    expect(resultados).toHaveLength(2);
    expect(resultados.every((e) => e.grupoMuscular === "Pecho")).toBe(true);
  });

  it("update persiste y es atómico (se re-lee de la base)", async () => {
    const creado = await ejercicioRepository.create({
      nombre: "Sentadilla",
      grupoMuscular: "Piernas",
      descripcion: "Con barra",
    });

    const actualizado = await ejercicioRepository.update(creado.id, { descripcion: "Con barra alta" });
    expect(actualizado?.descripcion).toBe("Con barra alta");

    // Re-lectura directa: el cambio quedó en la base y los campos no tocados sobrevivieron.
    const releido = await prisma.ejercicio.findUnique({ where: { id: creado.id } });
    expect(releido?.descripcion).toBe("Con barra alta");
    expect(releido?.nombre).toBe("Sentadilla");
    expect(releido?.grupoMuscular).toBe("Piernas");
    expect(releido?.createdAt).toEqual(creado.createdAt);
  });

  it("la restricción @@unique([rutinaId, ejercicioId]) rechaza un duplicado (P2002 real)", async () => {
    const ejercicio = await ejercicioRepository.create({ nombre: "Dominadas", grupoMuscular: "Espalda" });
    const rutina = await crearRutina();

    await crearEjercicioEnRutina(rutina.id, ejercicio.id);

    await expect(crearEjercicioEnRutina(rutina.id, ejercicio.id)).rejects.toMatchObject({
      code: "P2002",
    });
  });
});
