import type { Maquina, Prisma } from "@prisma/client";
import {
  MaquinaRepository,
  maquinaRepository,
  esErrorP2002,
  type MaquinaReader,
} from "./maquina-repositorio";
import type { EjercicioAsociado, EstadoAsignable, EstadoMaquina, TipoEquipamiento } from "./maquina";

const maquinaBase: Maquina = {
  id: "c1234567890123456789012345",
  nombre: "Polea alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
  estado: "DISPONIBLE" as EstadoAsignable,
  fechaAlta: new Date(),
  updatedAt: new Date(),
};

function mockReader(overrides: Partial<MaquinaReader> = {}): MaquinaReader {
  const reader = {
    maquina: {
      create: jest.fn().mockResolvedValue(maquinaBase),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(maquinaBase),
      delete: jest.fn().mockResolvedValue(maquinaBase),
      ...overrides.maquina,
    },
    ejercicioMaquina: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.ejercicioMaquina,
    },
    ejercicio: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.ejercicio,
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MaquinaReader;

  reader.$transaction = jest.fn(
    async (fn: (tx: MaquinaReader) => Promise<unknown>) => fn(reader)
  ) as unknown as MaquinaReader["$transaction"];

  return reader;
}

function ejercicioAsociado(id: string, nombre: string, grupoMuscular = "Pecho"): EjercicioAsociado {
  return { id, nombre, grupoMuscular };
}

const argsLecturaAsociados = {
  where: { maquinaId: "m1" },
  include: { ejercicio: { select: { id: true, nombre: true, grupoMuscular: true } } },
  orderBy: { ejercicio: { nombre: "asc" } },
};

const datosValidos = {
  nombre: "Polea alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
  estado: "DISPONIBLE" as EstadoAsignable,
};

describe("MaquinaRepository", () => {
  describe("create", () => {
    it("consulta el duplicado antes de insertar", async () => {
      const reader = mockReader({ $queryRaw: jest.fn().mockResolvedValue([{ n: 1 }]) });
      const repo = new MaquinaRepository();

      await expect(repo.create(datosValidos, reader)).rejects.toMatchObject({
        code: "DUPLICATE_NOMBRE_UBICACION",
      });
      expect(reader.maquina.create).not.toHaveBeenCalled();
    });

    it("compara con unaccent(lower(btrim(...)))", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      await repo.create(datosValidos, reader);

      const query = (reader.$queryRaw as jest.Mock).mock.calls[0][0] as Prisma.Sql;
      const queryText = query.text ?? query.sql ?? "";
      expect(queryText).toMatch(/unaccent\(lower\(btrim\("nombre"\)\)\)/i);
      expect(queryText).toMatch(/unaccent\(lower\(btrim\("ubicacion"\)\)\)/i);
    });

    it("traduce P2002 a DUPLICATE_NOMBRE_UBICACION", async () => {
      const reader = mockReader({
        maquina: {
          create: jest.fn().mockRejectedValue(Object.assign(new Error("P2002"), { code: "P2002" })),
        } as Partial<MaquinaReader["maquina"]> as MaquinaReader["maquina"],
      });
      const repo = new MaquinaRepository();

      await expect(repo.create(datosValidos, reader)).rejects.toMatchObject({
        code: "DUPLICATE_NOMBRE_UBICACION",
      });
    });

    it("propaga un error que no es P2002", async () => {
      const reader = mockReader({
        maquina: {
          create: jest.fn().mockRejectedValue(new Error("DB_DOWN")),
        } as Partial<MaquinaReader["maquina"]> as MaquinaReader["maquina"],
      });
      const repo = new MaquinaRepository();

      await expect(repo.create(datosValidos, reader)).rejects.toThrow("DB_DOWN");
    });

    it("inserta los valores ya normalizados", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      await repo.create(datosValidos, reader);

      expect(reader.maquina.create).toHaveBeenCalledWith({
        data: datosValidos,
      });
    });
  });

  describe("update", () => {
    it("excluye el propio id de la pre-consulta", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      await repo.update("id-123", datosValidos, reader);

      const query = (reader.$queryRaw as jest.Mock).mock.calls[0][0] as Prisma.Sql;
      const queryText = query.text ?? query.sql ?? "";
      expect(queryText).toMatch(/"id"\s*<>/i);
      expect(query.values).toContain("id-123");
    });

    it("traduce P2002 a DUPLICATE_NOMBRE_UBICACION", async () => {
      const reader = mockReader({
        maquina: {
          findUnique: jest.fn().mockResolvedValue(maquinaBase),
          update: jest.fn().mockRejectedValue(Object.assign(new Error("P2002"), { code: "P2002" })),
        } as Partial<MaquinaReader["maquina"]> as MaquinaReader["maquina"],
      });
      const repo = new MaquinaRepository();

      await expect(repo.update("id-123", datosValidos, reader)).rejects.toMatchObject({
        code: "DUPLICATE_NOMBRE_UBICACION",
      });
    });
  });

  describe("getById", () => {
    it("devuelve null cuando no existe", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      const result = await repo.getById("no-existe", reader);

      expect(result).toBeNull();
      expect(reader.maquina.findUnique).toHaveBeenCalledWith({ where: { id: "no-existe" } });
    });
  });

  describe("getAll", () => {
    it("traduce estado, tipoEquipamiento y nombre a un where de Prisma", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      await repo.getAll(
        {
          estado: "DISPONIBLE" as EstadoAsignable,
          tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
          nombre: "polea",
        },
        reader
      );

      expect(reader.maquina.findMany).toHaveBeenCalledWith({
        where: {
          estado: "DISPONIBLE",
          tipoEquipamiento: "MAQUINA_GUIADA",
          nombre: { contains: "polea", mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
      });
    });

    it("usa contains + mode insensitive para nombre", async () => {
      const reader = mockReader();
      const repo = new MaquinaRepository();

      await repo.getAll({ nombre: "PRENSA" }, reader);

      expect(reader.maquina.findMany).toHaveBeenCalledWith({
        where: { nombre: { contains: "PRENSA", mode: "insensitive" } },
        orderBy: { nombre: "asc" },
      });
    });

    it("acepta OCUPADA como filtro de estado para listar filas legacy", async () => {
      const ocupadaRow = { ...maquinaBase, estado: "OCUPADA" as EstadoMaquina };
      const reader = mockReader({
        maquina: {
          findMany: jest.fn().mockResolvedValue([ocupadaRow]),
        } as Partial<MaquinaReader["maquina"]> as MaquinaReader["maquina"],
      });
      const repo = new MaquinaRepository();

      const result = await repo.getAll({ estado: "OCUPADA" as EstadoMaquina }, reader);

      expect(reader.maquina.findMany).toHaveBeenCalledWith({
        where: { estado: "OCUPADA" },
        orderBy: { nombre: "asc" },
      });
      expect(result).toEqual([ocupadaRow]);
    });
  });

  describe("delete", () => {
    it("propaga errores de infraestructura", async () => {
      const reader = mockReader({
        maquina: {
          delete: jest.fn().mockRejectedValue(new Error("DB_DOWN")),
        } as Partial<MaquinaReader["maquina"]> as MaquinaReader["maquina"],
      });
      const repo = new MaquinaRepository();

      await expect(repo.delete("id-123", reader)).rejects.toThrow("DB_DOWN");
    });
  });

  describe("esErrorP2002", () => {
    it("detecta un error con code P2002", () => {
      expect(esErrorP2002(Object.assign(new Error("x"), { code: "P2002" }))).toBe(true);
    });

    it("rechaza un error sin code", () => {
      expect(esErrorP2002(new Error("x"))).toBe(false);
    });

    it("rechaza valores no error", () => {
      expect(esErrorP2002(null)).toBe(false);
      expect(esErrorP2002("P2002")).toBe(false);
    });
  });
});

describe("MaquinaRepository — ejercicios asociados", () => {
  const repo = new MaquinaRepository();

  describe("contarEjerciciosAsociados", () => {
    it("delega count con el filtro por maquinaId", async () => {
      const reader = mockReader();
      (reader.ejercicioMaquina.count as jest.Mock).mockResolvedValue(3);

      const total = await repo.contarEjerciciosAsociados("m1", reader);

      expect(total).toBe(3);
      expect(reader.ejercicioMaquina.count).toHaveBeenCalledWith({
        where: { maquinaId: "m1" },
      });
    });
  });

  describe("obtenerEjerciciosExistentes", () => {
    it("consulta por id in y mapea los encontrados a un Set", async () => {
      const reader = mockReader();
      (reader.ejercicio.findMany as jest.Mock).mockResolvedValue([{ id: "e1" }, { id: "e3" }]);

      const existentes = await repo.obtenerEjerciciosExistentes(["e1", "e2", "e3"], reader);

      expect(reader.ejercicio.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["e1", "e2", "e3"] } },
        select: { id: true },
      });
      expect(existentes).toEqual(new Set(["e1", "e3"]));
      expect(existentes.has("e2")).toBe(false);
    });

    it("con un arreglo vacío devuelve un Set vacío sin consultar", async () => {
      const reader = mockReader();

      const existentes = await repo.obtenerEjerciciosExistentes([], reader);

      expect(existentes.size).toBe(0);
      expect(reader.ejercicio.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getEjerciciosAsociados", () => {
    it("incluye el ejercicio con id/nombre/grupoMuscular y ordena por nombre", async () => {
      const reader = mockReader();
      (reader.ejercicioMaquina.findMany as jest.Mock).mockResolvedValue([
        { ejercicio: ejercicioAsociado("e1", "Abductores", "Piernas") },
        { ejercicio: ejercicioAsociado("e2", "Press banca") },
      ]);

      const asociados = await repo.getEjerciciosAsociados("m1", reader);

      expect(reader.ejercicioMaquina.findMany).toHaveBeenCalledWith(argsLecturaAsociados);
      expect(asociados).toEqual([
        ejercicioAsociado("e1", "Abductores", "Piernas"),
        ejercicioAsociado("e2", "Press banca"),
      ]);
    });

    it("devuelve [] cuando no hay filas", async () => {
      const reader = mockReader();

      await expect(repo.getEjerciciosAsociados("m1", reader)).resolves.toEqual([]);
    });
  });

  describe("reemplazarEjerciciosAsociados", () => {
    it("corre deleteMany → createMany → findMany en un solo $transaction", async () => {
      const reader = mockReader();
      (reader.ejercicioMaquina.findMany as jest.Mock).mockResolvedValue([
        { ejercicio: ejercicioAsociado("e2", "Sentadilla", "Piernas") },
      ]);

      const asociados = await repo.reemplazarEjerciciosAsociados("m1", ["e1", "e2"], reader);

      expect(reader.$transaction).toHaveBeenCalledTimes(1);
      expect(reader.ejercicioMaquina.deleteMany).toHaveBeenCalledWith({
        where: { maquinaId: "m1" },
      });
      expect(reader.ejercicioMaquina.createMany).toHaveBeenCalledWith({
        data: [
          { maquinaId: "m1", ejercicioId: "e1" },
          { maquinaId: "m1", ejercicioId: "e2" },
        ],
      });
      expect(reader.ejercicioMaquina.findMany).toHaveBeenCalledWith(argsLecturaAsociados);
      expect(asociados).toEqual([ejercicioAsociado("e2", "Sentadilla", "Piernas")]);

      const { deleteMany, createMany, findMany } =
        reader.ejercicioMaquina as unknown as Record<string, jest.Mock>;
      expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(createMany.mock.invocationCallOrder[0]);
      expect(createMany.mock.invocationCallOrder[0]).toBeLessThan(findMany.mock.invocationCallOrder[0]);
    });

    it("con [] borra sin llamar a createMany", async () => {
      const reader = mockReader();

      const asociados = await repo.reemplazarEjerciciosAsociados("m1", [], reader);

      expect(asociados).toEqual([]);
      expect(reader.ejercicioMaquina.deleteMany).toHaveBeenCalledWith({
        where: { maquinaId: "m1" },
      });
      expect(reader.ejercicioMaquina.createMany).not.toHaveBeenCalled();
      expect(reader.$transaction).toHaveBeenCalledTimes(1);
    });

    it("propaga el error de la transacción", async () => {
      const reader = mockReader();
      (reader.ejercicioMaquina.deleteMany as jest.Mock).mockRejectedValue(new Error("TX_DOWN"));

      await expect(
        repo.reemplazarEjerciciosAsociados("m1", ["e1"], reader)
      ).rejects.toThrow("TX_DOWN");
    });
  });
});

describe("maquinaRepository singleton", () => {
  it("es una instancia de MaquinaRepository", () => {
    expect(maquinaRepository).toBeInstanceOf(MaquinaRepository);
  });
});
