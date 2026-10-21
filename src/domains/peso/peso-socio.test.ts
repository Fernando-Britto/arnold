/**
 * Peso corporal del socio (T-048, D-65): registrar un pesaje y fijar o borrar la meta.
 * Prisma va mockeado: no hay base alcanzable desde los tests.
 */
import { borrarPeso, fijarMetaDePeso, registrarPeso } from "./peso-socio";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    medicionDePeso: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() },
    socio: { update: jest.fn() },
  };
  return { prisma };
});

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

beforeEach(async () => {
  const prisma = await mocks();
  for (const modelo of [prisma.medicionDePeso, prisma.socio]) {
    for (const fn of Object.values(modelo)) (fn as jest.Mock).mockReset();
  }
});

describe("registrarPeso", () => {
  const FECHA = new Date("2026-10-18T14:00:00.000Z");

  it("guarda el pesaje del socio con la fecha indicada", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.create as jest.Mock).mockResolvedValue({ id: "m1", peso: "78.4", fecha: FECHA });

    const r = await registrarPeso({ socioId: "socio-1", peso: 78.4, ahora: FECHA });

    expect(prisma.medicionDePeso.create).toHaveBeenCalledWith({
      data: { socioId: "socio-1", peso: 78.4, fecha: FECHA },
    });
    expect(r).toEqual({ id: "m1", peso: 78.4, fecha: FECHA });
  });

  it("devuelve el peso como número aunque la base lo entregue como Decimal", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.create as jest.Mock).mockResolvedValue({ id: "m1", peso: { toString: () => "78.40" }, fecha: FECHA });

    const r = await registrarPeso({ socioId: "socio-1", peso: 78.4, ahora: FECHA });

    expect(r.peso).toBe(78.4);
  });

  it("guarda el peso con dos decimales como máximo", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.create as jest.Mock).mockResolvedValue({ id: "m1", peso: "78.46", fecha: FECHA });

    await registrarPeso({ socioId: "socio-1", peso: 78.456 });

    expect((prisma.medicionDePeso.create as jest.Mock).mock.calls[0][0].data.peso).toBe(78.46);
  });

  it.each([[784], [10], ["78,4"], [null]])("un peso inválido (%p) es un error de validación y no toca la base", async (peso) => {
    const prisma = await mocks();

    await expect(registrarPeso({ socioId: "socio-1", peso: peso as never })).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.medicionDePeso.create).not.toHaveBeenCalled();
  });
});

describe("fijarMetaDePeso", () => {
  it("fija la meta guardando el último pesaje como peso de partida", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.findFirst as jest.Mock).mockResolvedValue({ peso: "82.50" });
    (prisma.socio.update as jest.Mock).mockResolvedValue({});

    const r = await fijarMetaDePeso({ socioId: "socio-1", pesoObjetivo: 77 });

    expect(prisma.medicionDePeso.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1" },
      orderBy: { fecha: "desc" },
      select: { peso: true },
    });
    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { pesoObjetivo: 77, pesoInicialDeMeta: 82.5 },
    });
    expect(r).toEqual({ pesoObjetivo: 77, pesoInicial: 82.5 });
  });

  it("sin ningún pesaje no se puede fijar una meta: no se sabría desde dónde se parte", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(fijarMetaDePeso({ socioId: "socio-1", pesoObjetivo: 77 })).rejects.toThrow(
      /VALIDATION_ERROR: Registrá tu peso antes de fijar una meta/
    );
    expect(prisma.socio.update).not.toHaveBeenCalled();
  });

  it("una meta inválida es un error de validación que nombra la meta y no toca la base", async () => {
    const prisma = await mocks();

    await expect(fijarMetaDePeso({ socioId: "socio-1", pesoObjetivo: 7 })).rejects.toThrow(
      /VALIDATION_ERROR: La meta tiene que estar entre 20 y 400 kg/
    );
    expect(prisma.medicionDePeso.findFirst).not.toHaveBeenCalled();
    expect(prisma.socio.update).not.toHaveBeenCalled();
  });

  it("con null borra la meta y el peso de partida, sin pedir ningún pesaje", async () => {
    const prisma = await mocks();
    (prisma.socio.update as jest.Mock).mockResolvedValue({});

    const r = await fijarMetaDePeso({ socioId: "socio-1", pesoObjetivo: null });

    expect(prisma.medicionDePeso.findFirst).not.toHaveBeenCalled();
    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { pesoObjetivo: null, pesoInicialDeMeta: null },
    });
    expect(r).toEqual({ pesoObjetivo: null, pesoInicial: null });
  });
});

describe("borrarPeso", () => {
  it("borra el pesaje filtrando por el socio del token", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await borrarPeso({ socioId: "socio-1", id: "m1" });

    expect(prisma.medicionDePeso.deleteMany).toHaveBeenCalledWith({
      where: { id: "m1", socioId: "socio-1" },
    });
  });

  it("un pesaje ajeno o inexistente es NOT_FOUND (no se distingue)", async () => {
    const prisma = await mocks();
    (prisma.medicionDePeso.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(borrarPeso({ socioId: "socio-1", id: "m-ajeno" })).rejects.toThrow("NOT_FOUND");
  });
});
