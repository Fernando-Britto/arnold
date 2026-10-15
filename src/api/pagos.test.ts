/**
 * API layer de pagos (T-032): handlers server-side y helpers de fetch del cliente.
 * El dominio va mockeado: acá se verifica que la capa API delegue y que los helpers
 * de fetch armen bien la petición.
 */
import {
  handleRegistrarPago,
  handleListarPagos,
  handleAnularPago,
  createPago,
  fetchPagosDeSocio,
  anularPago,
} from "./pagos";
import {
  registrarPago,
  listarPagosDeSocio,
  type PagoRegistrado,
} from "@/domains/pago/registrar-pago";
import { anularPago as anularPagoDominio } from "@/domains/pago/anular-pago";

jest.mock("@/domains/pago/registrar-pago");
jest.mock("@/domains/pago/anular-pago");

const mockRegistrarPago = registrarPago as jest.MockedFunction<typeof registrarPago>;
const mockListar = listarPagosDeSocio as jest.MockedFunction<typeof listarPagosDeSocio>;
const mockAnularDominio = anularPagoDominio as jest.MockedFunction<typeof anularPagoDominio>;

const pagoFalso = {
  pago: { id: "pago-1", monto: 30000 },
  cuota: { id: "cuota-1" },
  plan: { tipo: "RENOVACION", periodos: ["2026-11"], monto: 30000 },
  estadoCuota: "AL_DIA",
} as unknown as PagoRegistrado;

describe("handleRegistrarPago", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el servicio de dominio con el input recibido", async () => {
    mockRegistrarPago.mockResolvedValueOnce(pagoFalso);
    const input = { socioId: "socio-1", metodoPago: "EFECTIVO" };

    const r = await handleRegistrarPago(input);

    expect(r).toEqual(pagoFalso);
    expect(mockRegistrarPago).toHaveBeenCalledWith(input);
  });
});

describe("handleListarPagos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el servicio que lista los pagos del socio", async () => {
    mockListar.mockResolvedValueOnce([] as never);

    const r = await handleListarPagos("socio-1");

    expect(r).toEqual([]);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});

describe("handleAnularPago", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el dominio de anulación con el input recibido", async () => {
    const anulado = { pago: { id: "pago-1" }, cuotaEliminada: "cuota-1" };
    mockAnularDominio.mockResolvedValueOnce(anulado as never);

    const r = await handleAnularPago({ pagoId: "pago-1", motivo: "cobro por error" });

    expect(r).toEqual(anulado);
    expect(mockAnularDominio).toHaveBeenCalledWith({
      pagoId: "pago-1",
      motivo: "cobro por error",
    });
  });
});

describe("createPago (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/pagos con el cuerpo en JSON", async () => {
    const resultado = { pago: { id: "pago-1" }, estadoCuota: "AL_DIA" };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => resultado,
    });

    const r = await createPago({ socioId: "socio-1", metodoPago: "EFECTIVO" });

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/pagos",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });
});

describe("fetchPagosDeSocio (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace GET /api/pagos?socioId= con el id codificado", async () => {
    const lista = [{ id: "pago-1", estado: "CONFIRMADO" }];
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => lista });

    const r = await fetchPagosDeSocio("socio 1");

    expect(r).toEqual(lista);
    expect(global.fetch).toHaveBeenCalledWith("/api/pagos?socioId=socio%201");
  });
});

describe("anularPago (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/pagos/{id}/anular con el motivo en JSON", async () => {
    const resultado = { pago: { id: "pago-1" }, cuotaEliminada: "cuota-1" };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => resultado });

    const r = await anularPago("pago-1", "cobro por error");

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/pagos/pago-1/anular",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ motivo: "cobro por error" }),
      })
    );
  });
});
