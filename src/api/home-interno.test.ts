import { fetchHomeInternoPart1 } from "./home-interno";

describe("fetchHomeInternoPart1", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("fetches GET /api/home-interno and revives ISO strings into Dates", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ahora: "2026-09-30T18:00:00.000Z",
        config: { capacidadMaxima: 100, periodoGracia: 3, diasInactividad: 15 },
        maquinas: [{ estado: "DISPONIBLE" }],
        pagos: [{ monto: 50, metodoPago: "EFECTIVO", estado: "CONFIRMADO", fecha: "2026-09-30T10:00:00.000Z" }],
        cuotas: [{ socioId: "s1", socioNombre: "Marta G.", fechaVencimiento: "2026-10-01T00:00:00.000Z" }],
        ultimasAsistencias: ["2026-09-01T00:00:00.000Z", null],
        aforo: { asistenciasActivas: 87, horas: [], horaActual: 18 },
        personal: [{ rol: "INSTRUCTOR" }],
      }),
    });

    const result = await fetchHomeInternoPart1();

    expect(global.fetch).toHaveBeenCalledWith("/api/home-interno");
    expect(result.ahora).toEqual(new Date("2026-09-30T18:00:00.000Z"));
    expect(result.pagos[0].fecha).toBeInstanceOf(Date);
    expect(result.cuotas[0].fechaVencimiento).toBeInstanceOf(Date);
    expect(result.ultimasAsistencias[0]).toBeInstanceOf(Date);
    expect(result.ultimasAsistencias[1]).toBeNull();
  });

  it("throws a descriptive error when the request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, statusText: "Internal Server Error" });
    await expect(fetchHomeInternoPart1()).rejects.toThrow(
      "Failed to fetch home-interno data: Internal Server Error"
    );
  });
});
