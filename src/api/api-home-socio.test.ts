import { fetchHomeSocioData, type HomeSocioViewModel } from "./home-socio";

describe("fetchHomeSocioData", () => {
  const mockData: HomeSocioViewModel = {
    progreso: null,
    aforo: { ocupacionActual: 10, capacidadMaxima: 100, horas: [], horaActual: 12 },
    rutinaActiva: null,
    sesionEnProgreso: false,
    racha: { semanasRacha: 0, dias: [] },
    membresia: null,
  };

  beforeEach(() => {
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
