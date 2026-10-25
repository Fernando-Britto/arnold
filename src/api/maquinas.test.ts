/**
 * Business logic tests for Maquina API handlers and client wrappers
 * T-053f: server handlers + client wrappers
 */

import {
  handleMaquinaList,
  handleMaquinaCreate,
  handleMaquinaGetById,
  handleMaquinaUpdate,
  handleMaquinaDelete,
  handleMaquinaEjerciciosGet,
  handleMaquinaEjerciciosPut,
  fetchMaquinasList,
  createMaquina,
  updateMaquina,
  deleteMaquina,
  fetchMaquinaEjercicios,
  reemplazarEjerciciosMaquina,
} from "./maquinas";
import { maquinaRepository } from "@/domains/maquina/maquina-repositorio";
import * as maquinaDomain from "@/domains/maquina/maquina";
import * as cacheCliente from "@/lib/cache-cliente";
import { CLAVES, limpiarCache } from "@/lib/cache-cliente";
import type {
  Maquina,
  MaquinaInput,
  EjercicioAsociado,
} from "@/domains/maquina/maquina";

jest.mock("@/domains/maquina/maquina-repositorio", () => ({
  maquinaRepository: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    contarEjerciciosAsociados: jest.fn(),
    obtenerEjerciciosExistentes: jest.fn(),
    getEjerciciosAsociados: jest.fn(),
    reemplazarEjerciciosAsociados: jest.fn(),
  },
}));

const mockMaquina: Maquina = {
  id: "m1",
  nombre: "Polea alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA",
  estado: "DISPONIBLE",
  fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Maquina Business Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleMaquinaList", () => {
    it("devuelve la lista y propaga los filtros", async () => {
      const lista = [mockMaquina];
      (maquinaRepository.getAll as jest.Mock).mockResolvedValue(lista);

      const result = await handleMaquinaList({
        estado: "DISPONIBLE",
        tipoEquipamiento: "MAQUINA_GUIADA",
        nombre: "Polea",
      });

      expect(result).toEqual(lista);
      expect(maquinaRepository.getAll).toHaveBeenCalledWith({
        estado: "DISPONIBLE",
        tipoEquipamiento: "MAQUINA_GUIADA",
        nombre: "Polea",
      });
    });

    it("acepta llamarse sin filtros", async () => {
      const lista = [mockMaquina];
      (maquinaRepository.getAll as jest.Mock).mockResolvedValue(lista);

      const result = await handleMaquinaList();

      expect(result).toEqual(lista);
      expect(maquinaRepository.getAll).toHaveBeenCalledWith({});
    });
  });

  describe("handleMaquinaCreate", () => {
    it("rechaza una entrada inválida con VALIDATION_ERROR", async () => {
      await expect(
        handleMaquinaCreate({
          nombre: "",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "DISPONIBLE",
        })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("nombre"),
      });
      expect(maquinaRepository.create).not.toHaveBeenCalled();
    });

    it("rechaza un cuerpo que no es un objeto plano con VALIDATION_ERROR", async () => {
      await expect(
        handleMaquinaCreate(null as unknown as MaquinaInput)
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El cuerpo debe ser un objeto"),
      });
      expect(maquinaRepository.create).not.toHaveBeenCalled();
    });

    it("rechaza OCUPADA con ESTADO_NO_ASIGNABLE", async () => {
      await expect(
        handleMaquinaCreate({
          nombre: "Polea alta",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "OCUPADA",
        })
      ).rejects.toMatchObject({ code: "ESTADO_NO_ASIGNABLE" });
      expect(maquinaRepository.create).not.toHaveBeenCalled();
    });

    it("normaliza antes de guardar", async () => {
      const created = { ...mockMaquina, id: "m2", nombre: "Polea baja", ubicacion: "Sala principal" };
      (maquinaRepository.create as jest.Mock).mockResolvedValue(created);

      const result = await handleMaquinaCreate({
        nombre: "  Polea   baja  ",
        ubicacion: " Sala   principal ",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      });

      expect(maquinaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Polea baja",
          ubicacion: "Sala principal",
        })
      );
      expect(result).toEqual(created);
    });

    it("propaga DUPLICATE_NOMBRE_UBICACION del repositorio", async () => {
      const error = Object.assign(
        new Error(
          "DUPLICATE_NOMBRE_UBICACION: Ya existe una máquina con el mismo nombre y ubicación"
        ),
        { code: "DUPLICATE_NOMBRE_UBICACION" }
      );
      (maquinaRepository.create as jest.Mock).mockRejectedValue(error);

      await expect(
        handleMaquinaCreate({
          nombre: "Polea alta",
          ubicacion: "Sala principal",
          tipoEquipamiento: "MAQUINA_GUIADA",
          estado: "DISPONIBLE",
        })
      ).rejects.toMatchObject({ code: "DUPLICATE_NOMBRE_UBICACION" });
    });
  });

  describe("handleMaquinaGetById", () => {
    it('lanza NOT_FOUND con "Máquina no encontrada"', async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(handleMaquinaGetById("no-existe")).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: expect.stringContaining("Máquina no encontrada"),
      });
    });
  });

  describe("handleMaquinaUpdate", () => {
    it("lanza NOT_FOUND cuando no existe", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(
        handleMaquinaUpdate("no-existe", { nombre: "Nuevo nombre" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rechaza un cuerpo nulo con VALIDATION_ERROR", async () => {
      await expect(
        handleMaquinaUpdate("m1", null as unknown as MaquinaInput)
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El cuerpo debe ser un objeto"),
      });
      expect(maquinaRepository.update).not.toHaveBeenCalled();
    });

    it("rechaza un cuerpo array con VALIDATION_ERROR", async () => {
      await expect(
        handleMaquinaUpdate("m1", [] as unknown as MaquinaInput)
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El cuerpo debe ser un objeto"),
      });
      expect(maquinaRepository.update).not.toHaveBeenCalled();
    });

    it("rechaza OCUPADA aunque el valor no cambie", async () => {
      const ocupada = { ...mockMaquina, estado: "OCUPADA" };
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(ocupada);

      await expect(
        handleMaquinaUpdate("m1", { nombre: "Otro nombre" })
      ).rejects.toMatchObject({ code: "ESTADO_NO_ASIGNABLE" });
      expect(maquinaRepository.update).not.toHaveBeenCalled();
    });

    it("valida el registro combinado", async () => {
      const existing = { ...mockMaquina };
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);

      await expect(
        handleMaquinaUpdate("m1", { nombre: "A" })
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(maquinaRepository.update).not.toHaveBeenCalled();
    });

    it("propaga DUPLICATE_NOMBRE_UBICACION", async () => {
      const existing = { ...mockMaquina };
      const error = Object.assign(
        new Error(
          "DUPLICATE_NOMBRE_UBICACION: Ya existe una máquina con el mismo nombre y ubicación"
        ),
        { code: "DUPLICATE_NOMBRE_UBICACION" }
      );
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);
      (maquinaRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        handleMaquinaUpdate("m1", { nombre: "Polea baja" })
      ).rejects.toMatchObject({ code: "DUPLICATE_NOMBRE_UBICACION" });
    });
  });

  describe("handleMaquinaDelete", () => {
    it("lanza NOT_FOUND cuando no existe", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(handleMaquinaDelete("no-existe")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("consulta contarEjerciciosAsociados antes de decidir y borra", async () => {
      const existing = { ...mockMaquina };
      const puedeEliminarSpy = jest.spyOn(maquinaDomain, "puedeEliminar");
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);
      (maquinaRepository.contarEjerciciosAsociados as jest.Mock).mockResolvedValue(0);
      (maquinaRepository.delete as jest.Mock).mockResolvedValue(existing);

      await handleMaquinaDelete("m1");

      expect(maquinaRepository.contarEjerciciosAsociados).toHaveBeenCalledWith("m1");
      expect(puedeEliminarSpy).toHaveBeenCalledWith(existing, {
        ejerciciosAsociados: 0,
      });
      expect(maquinaRepository.delete).toHaveBeenCalledWith("m1");
    });

    it("lanza DELETE_BLOCKED_EJERCICIOS con el conteo real", async () => {
      const existing = { ...mockMaquina };
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);
      (maquinaRepository.contarEjerciciosAsociados as jest.Mock).mockResolvedValue(3);

      await expect(handleMaquinaDelete("m1")).rejects.toMatchObject({
        code: "DELETE_BLOCKED_EJERCICIOS",
        message: expect.stringContaining(
          "No se puede eliminar: 3 ejercicios usan esta máquina"
        ),
      });
      expect(maquinaRepository.delete).not.toHaveBeenCalled();
    });

    it("borra cuando el conteo es 0", async () => {
      const existing = { ...mockMaquina };
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);
      (maquinaRepository.contarEjerciciosAsociados as jest.Mock).mockResolvedValue(0);
      (maquinaRepository.delete as jest.Mock).mockResolvedValue(existing);

      await handleMaquinaDelete("m1");

      expect(maquinaRepository.delete).toHaveBeenCalledWith("m1");
    });
  });

  describe("handleMaquinaEjerciciosGet", () => {
    const mockAsociado: EjercicioAsociado = {
      id: "e1",
      nombre: "Press de banca",
      grupoMuscular: "Pecho",
    };

    it('lanza NOT_FOUND con "Máquina no encontrada"', async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(handleMaquinaEjerciciosGet("no-existe")).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: expect.stringContaining("Máquina no encontrada"),
      });
      expect(maquinaRepository.getEjerciciosAsociados).not.toHaveBeenCalled();
    });

    it("devuelve la lista asociada", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.getEjerciciosAsociados as jest.Mock).mockResolvedValue([
        mockAsociado,
      ]);

      const result = await handleMaquinaEjerciciosGet("m1");

      expect(result).toEqual([mockAsociado]);
      expect(maquinaRepository.getEjerciciosAsociados).toHaveBeenCalledWith("m1");
    });

    it("devuelve [] cuando la máquina existe sin asociaciones", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.getEjerciciosAsociados as jest.Mock).mockResolvedValue([]);

      await expect(handleMaquinaEjerciciosGet("m1")).resolves.toEqual([]);
      expect(maquinaRepository.getEjerciciosAsociados).toHaveBeenCalledWith("m1");
    });
  });

  describe("handleMaquinaEjerciciosPut", () => {
    const mockAsociado: EjercicioAsociado = {
      id: "e1",
      nombre: "Press de banca",
      grupoMuscular: "Pecho",
    };

    it("rechaza un cuerpo que no es objeto con VALIDATION_ERROR", async () => {
      await expect(
        handleMaquinaEjerciciosPut("m1", null)
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El cuerpo debe ser un objeto"),
      });
      await expect(
        handleMaquinaEjerciciosPut("m1", [] as unknown)
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El cuerpo debe ser un objeto"),
      });
      expect(maquinaRepository.getById).not.toHaveBeenCalled();
    });

    it("rechaza ejercicioIds que no es arreglo", async () => {
      await expect(
        handleMaquinaEjerciciosPut("m1", {})
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El campo ejercicioIds debe ser un arreglo"),
      });
      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: "e1" })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("El campo ejercicioIds debe ser un arreglo"),
      });
      expect(maquinaRepository.getById).not.toHaveBeenCalled();
    });

    it("rechaza elementos que no son string", async () => {
      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: ["e1", 2] })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining(
          "El campo ejercicioIds debe contener solo identificadores"
        ),
      });
      expect(maquinaRepository.getById).not.toHaveBeenCalled();
    });

    it("lanza NOT_FOUND sin escribir cuando la máquina no existe", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(
        handleMaquinaEjerciciosPut("no-existe", { ejercicioIds: ["e1"] })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: expect.stringContaining("Máquina no encontrada"),
      });
      expect(maquinaRepository.obtenerEjerciciosExistentes).not.toHaveBeenCalled();
      expect(maquinaRepository.reemplazarEjerciciosAsociados).not.toHaveBeenCalled();
    });

    it("rechaza ids inexistentes con VALIDATION_ERROR", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.obtenerEjerciciosExistentes as jest.Mock).mockResolvedValue(
        new Set(["e1"])
      );

      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: ["e1", "e2"] })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("Uno o más ejercicios no existen"),
      });
      expect(maquinaRepository.obtenerEjerciciosExistentes).toHaveBeenCalledWith([
        "e1",
        "e2",
      ]);
      expect(maquinaRepository.reemplazarEjerciciosAsociados).not.toHaveBeenCalled();
    });

    it("rechaza duplicados con VALIDATION_ERROR", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.obtenerEjerciciosExistentes as jest.Mock).mockResolvedValue(
        new Set(["e1"])
      );

      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: ["e1", "e1"] })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("Hay ejercicios duplicados en la asignación"),
      });
      expect(maquinaRepository.obtenerEjerciciosExistentes).not.toHaveBeenCalled();
      expect(maquinaRepository.reemplazarEjerciciosAsociados).not.toHaveBeenCalled();
    });

    it("rechaza 101 ids con VALIDATION_MAX_EJERCICIOS", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `e${i}`);
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.obtenerEjerciciosExistentes as jest.Mock).mockResolvedValue(
        new Set(ids)
      );

      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: ids })
      ).rejects.toMatchObject({
        code: "VALIDATION_MAX_EJERCICIOS",
        message: expect.stringContaining("No se pueden asignar más de 100 ejercicios"),
      });
      expect(maquinaRepository.obtenerEjerciciosExistentes).not.toHaveBeenCalled();
      expect(maquinaRepository.reemplazarEjerciciosAsociados).not.toHaveBeenCalled();
    });

    it("acepta [] y devuelve []", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.obtenerEjerciciosExistentes as jest.Mock).mockResolvedValue(
        new Set()
      );
      (maquinaRepository.reemplazarEjerciciosAsociados as jest.Mock).mockResolvedValue(
        []
      );

      await expect(
        handleMaquinaEjerciciosPut("m1", { ejercicioIds: [] })
      ).resolves.toEqual([]);
      expect(maquinaRepository.reemplazarEjerciciosAsociados).toHaveBeenCalledWith(
        "m1",
        []
      );
    });

    it("reemplaza y devuelve la lista nueva", async () => {
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(mockMaquina);
      (maquinaRepository.obtenerEjerciciosExistentes as jest.Mock).mockResolvedValue(
        new Set(["e1", "e2"])
      );
      (maquinaRepository.reemplazarEjerciciosAsociados as jest.Mock).mockResolvedValue(
        [mockAsociado]
      );

      const result = await handleMaquinaEjerciciosPut("m1", {
        ejercicioIds: ["e1", "e2"],
      });

      expect(result).toEqual([mockAsociado]);
      expect(maquinaRepository.obtenerEjerciciosExistentes).toHaveBeenCalledWith([
        "e1",
        "e2",
      ]);
      expect(maquinaRepository.reemplazarEjerciciosAsociados).toHaveBeenCalledWith(
        "m1",
        ["e1", "e2"]
      );
    });
  });
});

describe("Maquina client wrappers", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    limpiarCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it("fetchMaquinasList guarda la respuesta en CLAVES.maquinas", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockMaquina],
    });

    const result = await fetchMaquinasList();
    expect(result).toEqual([mockMaquina]);
    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas");

    const cached = await fetchMaquinasList();
    expect(cached).toEqual([mockMaquina]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("createMaquina invalida CLAVES.maquinas", async () => {
    const invalidateSpy = jest.spyOn(cacheCliente, "invalidarCache");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMaquina,
    });

    await createMaquina({
      nombre: "Polea baja",
      ubicacion: "Sala principal",
      tipoEquipamiento: "MAQUINA_GUIADA",
      estado: "DISPONIBLE",
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Polea baja",
        ubicacion: "Sala principal",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith(CLAVES.maquinas);
  });

  it("updateMaquina invalida CLAVES.maquinas", async () => {
    const invalidateSpy = jest.spyOn(cacheCliente, "invalidarCache");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMaquina,
    });

    await updateMaquina("m1", { nombre: "Polea baja" });

    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas/m1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Polea baja" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith(CLAVES.maquinas);
  });

  it("deleteMaquina invalida CLAVES.maquinas", async () => {
    const invalidateSpy = jest.spyOn(cacheCliente, "invalidarCache");
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await deleteMaquina("m1");

    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas/m1", {
      method: "DELETE",
    });
    expect(invalidateSpy).toHaveBeenCalledWith(CLAVES.maquinas);
  });

  it("fetchMaquinaEjercicios hace GET a /api/maquinas/{id}/ejercicios", async () => {
    const asociados: EjercicioAsociado[] = [
      { id: "e1", nombre: "Press de banca", grupoMuscular: "Pecho" },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => asociados,
    });

    await expect(fetchMaquinaEjercicios("m1")).resolves.toEqual(asociados);
    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas/m1/ejercicios");
  });

  it("fetchMaquinaEjercicios propaga el error del servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Máquina no encontrada" }),
    });

    await expect(fetchMaquinaEjercicios("no-existe")).rejects.toThrow(
      "Máquina no encontrada"
    );
  });

  it("reemplazarEjerciciosMaquina hace PUT con { ejercicioIds } y devuelve la lista", async () => {
    const asociados: EjercicioAsociado[] = [
      { id: "e2", nombre: "Sentadilla", grupoMuscular: "Piernas" },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => asociados,
    });

    const result = await reemplazarEjerciciosMaquina("m1", ["e2"]);

    expect(result).toEqual(asociados);
    expect(global.fetch).toHaveBeenCalledWith("/api/maquinas/m1/ejercicios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ejercicioIds: ["e2"] }),
    });
  });

  it("reemplazarEjerciciosMaquina invalida CLAVES.maquinas al terminar", async () => {
    const invalidateSpy = jest.spyOn(cacheCliente, "invalidarCache");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await reemplazarEjerciciosMaquina("m1", []);

    expect(invalidateSpy).toHaveBeenCalledWith(CLAVES.maquinas);
  });

  it("reemplazarEjerciciosMaquina no invalida el cache si el PUT falla", async () => {
    const invalidateSpy = jest.spyOn(cacheCliente, "invalidarCache");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Hay ejercicios duplicados en la asignación" }),
    });

    await expect(reemplazarEjerciciosMaquina("m1", ["e1", "e1"])).rejects.toThrow(
      "Hay ejercicios duplicados en la asignación"
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
