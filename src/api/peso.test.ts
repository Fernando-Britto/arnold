/**
 * Peso corporal del socio (T-048, D-65): handlers del servidor y llamadas del navegador.
 */
import {
  fijarMetaDePesoCorporal,
  handleFijarMeta,
  handleRegistrarPeso,
  registrarPesoCorporal,
} from "./peso";
import { fijarMetaDePeso, registrarPeso } from "@/domains/peso/peso-socio";

jest.mock("@/domains/peso/peso-socio");

const mockRegistrar = registrarPeso as jest.MockedFunction<typeof registrarPeso>;
const mockFijar = fijarMetaDePeso as jest.MockedFunction<typeof fijarMetaDePeso>;

describe("handlers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("handleRegistrarPeso delega en el dominio, que valida el peso", async () => {
    const pesaje = { id: "m1", peso: 78.4, fecha: new Date("2026-10-18T14:00:00.000Z") };
    mockRegistrar.mockResolvedValueOnce(pesaje);

    expect(await handleRegistrarPeso({ socioId: "socio-1", peso: 78.4 })).toEqual(pesaje);
    expect(mockRegistrar).toHaveBeenCalledWith({ socioId: "socio-1", peso: 78.4 });
  });

  it("handleFijarMeta delega en el dominio, también con null para borrar", async () => {
    mockFijar.mockResolvedValueOnce({ pesoObjetivo: null, pesoInicial: null });

    await handleFijarMeta({ socioId: "socio-1", pesoObjetivo: null });

    expect(mockFijar).toHaveBeenCalledWith({ socioId: "socio-1", pesoObjetivo: null });
  });
});

describe("llamadas del navegador", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it("registrarPesoCorporal hace POST a /api/peso con el peso", async () => {
    const pesaje = { id: "m1", peso: 78.4, fecha: "2026-10-18T14:00:00.000Z" };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => pesaje });

    expect(await registrarPesoCorporal(78.4)).toEqual(pesaje);
    expect(global.fetch).toHaveBeenCalledWith("/api/peso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peso: 78.4 }),
    });
  });

  it("fijarMetaDePesoCorporal hace PUT a /api/peso/meta, y manda null a propósito para borrar", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pesoObjetivo: 77, pesoInicial: 82.5 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pesoObjetivo: null, pesoInicial: null }) });

    await fijarMetaDePesoCorporal(77);
    await fijarMetaDePesoCorporal(null);

    const cuerpos = (global.fetch as jest.Mock).mock.calls.map(([, init]) => init.body);
    expect(cuerpos).toEqual([JSON.stringify({ pesoObjetivo: 77 }), JSON.stringify({ pesoObjetivo: null })]);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/peso/meta");
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe("PUT");
  });

  it("si el servidor rechaza, lanza con el mensaje del servidor", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ code: "VALIDATION_ERROR", message: "El peso tiene que estar entre 20 y 400 kg" }),
    });

    await expect(registrarPesoCorporal(784)).rejects.toThrow();
  });
});
