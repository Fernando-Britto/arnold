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
  fetchMaquinasList,
  createMaquina,
  updateMaquina,
  deleteMaquina,
} from "./maquinas";
import { maquinaRepository } from "@/domains/maquina/maquina-repositorio";
import * as maquinaDomain from "@/domains/maquina/maquina";
import * as cacheCliente from "@/lib/cache-cliente";
import { CLAVES, limpiarCache } from "@/lib/cache-cliente";
import type { Maquina } from "@/domains/maquina/maquina";

jest.mock("@/domains/maquina/maquina-repositorio", () => ({
  maquinaRepository: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

    it("consulta puedeEliminar con 0 y borra", async () => {
      const existing = { ...mockMaquina };
      const puedeEliminarSpy = jest.spyOn(maquinaDomain, "puedeEliminar");
      (maquinaRepository.getById as jest.Mock).mockResolvedValue(existing);
      (maquinaRepository.delete as jest.Mock).mockResolvedValue(existing);

      await handleMaquinaDelete("m1");

      expect(puedeEliminarSpy).toHaveBeenCalledWith(existing, {
        ejerciciosAsociados: 0,
      });
      expect(maquinaRepository.delete).toHaveBeenCalledWith("m1");
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
});
