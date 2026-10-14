/**
 * API layer de pagos (T-032): handlers server-side y helpers de fetch del cliente.
 * El dominio va mockeado: acá se verifica que la capa API delegue y que los helpers
 * de fetch armen bien la petición.
 */
import {
  handleRegistrarPago,
  handleListarPagos,
  createPago,
  fetchPagosDeSocio,
} from "./pagos";
import {
  registrarPago,
  listarPagosDeSocio,
  type PagoRegistrado,
} from "@/domains/pago/registrar-pago";

jest.mock("@/domains/pago/registrar-pago");

const mockRegistrarPago = registrarPago as jest.MockedFunction<typeof registrarPago>;
const mockListar = listarPagosDeSocio as jest.MockedFunction<typeof listarPagosDeSocio>;

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

  it("hace GET /api/pagos?socioId=... y devuelve la lista", async () => {
    const lista = [{ id: "pago-1", monto: 30000 }];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => lista,
    });

    const r = await fetchPagosDeSocio("socio-1");

    expect(r).toEqual(lista);
    // PG-7: la sesión va en cookie; el fetch no adjunta headers.
    expect(global.fetch).toHaveBeenCalledWith("/api/pagos?socioId=socio-1");
  });
});
