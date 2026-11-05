/**
 * Contrato de las secciones del socio (T-039, D-45): el fetch del cliente y su cache.
 */
import {
  fetchHomeSocioSeccionesData,
  type HomeSocioSeccionesViewModel,
} from "./home-socio-secciones";
import { limpiarCache } from "@/lib/cache-cliente";

describe("fetchHomeSocioSeccionesData", () => {
  const original = global.fetch;
  const mockData: HomeSocioSeccionesViewModel = {
    rutina: null,
    sesiones: [],
    sesionEnCurso: null,
    ejercicios: [],
    progreso: [],
    membresia: null,
    asistencias: { rachaSemanas: 0, total: 0, dias: [] },
  };

  beforeEach(() => {
    limpiarCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = original;
  });

  it("pide GET /api/home-socio/secciones y devuelve el payload parseado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchHomeSocioSeccionesData();

    expect(global.fetch).toHaveBeenCalledWith("/api/home-socio/secciones");
    expect(result).toEqual(mockData);
  });

  it("reutiliza el cache: dos llamadas pegan una sola vez", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    await fetchHomeSocioSeccionesData();
    await fetchHomeSocioSeccionesData();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
