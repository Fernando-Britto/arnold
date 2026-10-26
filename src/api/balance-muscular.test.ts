/**
 * Contrato del balance muscular (T-051 parte 2, D-107): el handler del servidor y el fetch del navegador.
 */
import { fetchBalanceMuscular, handleBalanceMuscular } from "./balance-muscular";
import { balanceMuscularDelSocio } from "@/domains/ejercicio/balance-muscular-datos";

jest.mock("@/domains/ejercicio/balance-muscular-datos");
const mockBalance = balanceMuscularDelSocio as jest.MockedFunction<typeof balanceMuscularDelSocio>;

describe("handleBalanceMuscular", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pide el balance del socio y del período, y serializa la fecha de inicio", async () => {
    mockBalance.mockResolvedValueOnce({
      periodo: "semana",
      desde: new Date("2026-10-09T03:00:00.000Z"),
      totalSeries: 7,
      musculos: [{ musculo: "pecho", etiqueta: "Pecho", series: 4, intensidad: 1 }],
      sinTrabajar: ["trapecios"],
    });

    const r = await handleBalanceMuscular({ socioId: "socio-1", periodo: "semana" });

    expect(mockBalance).toHaveBeenCalledWith({ socioId: "socio-1", periodo: "semana" });
    expect(r).toEqual({
      periodo: "semana",
      desde: "2026-10-09T03:00:00.000Z",
      totalSeries: 7,
      musculos: [{ musculo: "pecho", etiqueta: "Pecho", series: 4, intensidad: 1 }],
      sinTrabajar: ["trapecios"],
    });
  });

  it("en 'todo' no hay fecha de inicio", async () => {
    mockBalance.mockResolvedValueOnce({ periodo: "todo", desde: null, totalSeries: 0, musculos: [], sinTrabajar: [] });

    const r = await handleBalanceMuscular({ socioId: "socio-1", periodo: "todo" });

    expect(r.desde).toBeNull();
  });
});

describe("fetchBalanceMuscular", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it("pide el período por la URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ periodo: "90d" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await fetchBalanceMuscular("90d");

    expect(fetchMock).toHaveBeenCalledWith("/api/home-socio/musculos?periodo=90d");
    expect(r).toEqual({ periodo: "90d" });
  });

  it("si el servidor falla lanza el error con su mensaje", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: "BALANCE_MUSCULAR_ERROR", message: "No se pudo calcular el balance muscular" }),
    }) as unknown as typeof fetch;

    await expect(fetchBalanceMuscular("semana")).rejects.toMatchObject({
      message: "No se pudo calcular el balance muscular",
    });
  });
});
