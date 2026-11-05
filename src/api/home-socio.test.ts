import { fetchHomeSocioData, type HomeSocioViewModel } from "./home-socio";
import { limpiarCache } from "@/lib/cache-cliente";

describe("fetchHomeSocioData", () => {
  const mockData: HomeSocioViewModel = {
    progreso: null,
    aforo: { ocupacionActual: 10, capacidadMaxima: 100, horas: [], horaActual: 12 },
    rutinaActiva: null,
    sesionEnProgreso: false,
    racha: { semanasRacha: 0, dias: [] },
    membresia: null,
    oferta: null,
  ultimasSesiones: [],
    peso: { mediciones: [], pesoObjetivo: null, pesoInicial: null },
  };

  beforeEach(() => {
    limpiarCache();
    global.fetch = jest.fn();
  });

  it("fetches from GET /api/home-socio and returns the parsed view model", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchHomeSocioData();

    expect(global.fetch).toHaveBeenCalledWith("/api/home-socio");
    expect(result).toEqual(mockData);
  });

  it("reutiliza el cache: dos llamadas pegan una sola vez", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    await fetchHomeSocioData();
    await fetchHomeSocioData();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws a descriptive error when the request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    await expect(fetchHomeSocioData()).rejects.toThrow(
      "Failed to fetch home-socio data: Internal Server Error"
    );
  });
});
