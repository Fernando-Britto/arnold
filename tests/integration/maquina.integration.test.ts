import { prisma } from "@/lib/db";
import { maquinaRepository } from "@/domains/maquina/maquina-repositorio";
import { MAQUINAS } from "../../prisma/seed-data";

const datosBase = {
  nombre: "Polea Alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as const,
  estado: "DISPONIBLE" as const,
};

describe("MaquinaRepository contra Postgres real", () => {
  beforeAll(async () => {
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
    await prisma.maquina.deleteMany();
  });

  it("rechaza un duplicado que solo difiere en mayúsculas con P2002", async () => {
    await prisma.maquina.create({ data: datosBase });

    await expect(
      prisma.maquina.create({
        data: { ...datosBase, nombre: "polea alta", ubicacion: "sala principal" },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("el repositorio traduce el duplicado de mayúsculas a DUPLICATE_NOMBRE_UBICACION", async () => {
    await maquinaRepository.create(datosBase);

    await expect(
      maquinaRepository.create({
        ...datosBase,
        nombre: "polea alta",
        ubicacion: "sala principal",
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_NOMBRE_UBICACION" });
  });

  it("la pre-consulta rechaza un duplicado que solo difiere en tildes", async () => {
    await maquinaRepository.create({
      ...datosBase,
      nombre: "Polea",
    });

    await expect(
      maquinaRepository.create({
        ...datosBase,
        nombre: "Poléa",
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_NOMBRE_UBICACION" });
  });

  it("el índice no pliega tildes: el duplicado con tilde entra por SQL crudo", async () => {
    await prisma.maquina.create({
      data: { ...datosBase, nombre: "Polea" },
    });

    await expect(
      prisma.maquina.create({
        data: { ...datosBase, nombre: "Poléa" },
      })
    ).resolves.toMatchObject({ nombre: "Poléa" });
  });

  it("los seis pares (nombre, ubicacion) del seed son distintos y se insertan sin colisión", async () => {
    const pares = MAQUINAS.map((m) => ({
      n: m.nombre.toLowerCase().trim(),
      u: "Sala principal".toLowerCase().trim(),
    }));
    const unicos = new Set(pares.map((p) => `${p.n}|${p.u}`));
    expect(unicos.size).toBe(pares.length);

    await prisma.maquina.createMany({
      data: MAQUINAS.map((m) => ({ ...m, ubicacion: "Sala principal" })),
    });

    const count = await prisma.maquina.count();
    expect(count).toBe(MAQUINAS.length);
  });
});
