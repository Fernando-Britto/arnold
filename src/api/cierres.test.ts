/**
 * API layer de cierres (T-040): handlers server-side y helpers de fetch del cliente.
 * El dominio va mockeado: acá se verifica que la capa API resuelva el Empleado,
 * aplique el rango por defecto (día del gimnasio) y delegue.
 */
import {
  handleCerrarCaja,
  handleListarCierres,
  handlePrevisualizarCierre,
  createCierre,
  fetchPreviewCierre,
  fetchCierres,
} from "./cierres";
import {
  cerrarCaja,
  listarCierres,
  previsualizarCierre,
  resolverEmpleadoId,
} from "@/domains/cierre/cierre-de-caja";
import { startOfGymDay } from "@/lib/gym-time";

jest.mock("@/domains/cierre/cierre-de-caja");

const mockResolver = resolverEmpleadoId as jest.MockedFunction<typeof resolverEmpleadoId>;
const mockCerrar = cerrarCaja as jest.MockedFunction<typeof cerrarCaja>;
const mockListar = listarCierres as jest.MockedFunction<typeof listarCierres>;
const mockPreview = previsualizarCierre as jest.MockedFunction<typeof previsualizarCierre>;

const ahora = new Date("2026-10-12T15:00:00.000Z");
const cierreFalso = {
  id: "cierre-1",
  totalRecaudado: 1200,
  totalEfectivo: 1000,
  totalTransferencia: 0,
  totalTarjeta: 200,
  cantidadOperaciones: 2,
  pagos: [],
};

describe("handleCerrarCaja", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resuelve el Empleado y cierra con el rango por defecto (día del gimnasio hasta ahora)", async () => {
    mockResolver.mockResolvedValueOnce("emp-1");
    mockCerrar.mockResolvedValueOnce(cierreFalso as never);

    const r = await handleCerrarCaja({ usuarioId: "u-rec", ahora });

    expect(r).toEqual(cierreFalso);
    expect(mockResolver).toHaveBeenCalledWith("u-rec");
    expect(mockCerrar).toHaveBeenCalledWith({
      responsableId: "emp-1",
      desde: startOfGymDay(ahora),
      hasta: ahora,
    });
  });

  it("respeta el rango explícito cuando se envía", async () => {
    mockResolver.mockResolvedValueOnce("emp-1");
    mockCerrar.mockResolvedValueOnce(cierreFalso as never);
    const desde = new Date("2026-10-11T03:00:00.000Z");
    const hasta = new Date("2026-10-11T21:00:00.000Z");

    await handleCerrarCaja({ usuarioId: "u-rec", desde, hasta, ahora });

    expect(mockCerrar).toHaveBeenCalledWith({ responsableId: "emp-1", desde, hasta });
  });
});

describe("handleListarCierres", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el servicio que lista los cierres", async () => {
    mockListar.mockResolvedValueOnce([cierreFalso] as never);

    const r = await handleListarCierres();

    expect(r).toEqual([cierreFalso]);
    expect(mockListar).toHaveBeenCalled();
  });
});

describe("handlePrevisualizarCierre", () => {
  beforeEach(() => jest.clearAllMocks());

  it("previsualiza con el rango por defecto y expone el rango usado en ISO (CC-2)", async () => {
    mockPreview.mockResolvedValueOnce(cierreFalso as never);

    const r = await handlePrevisualizarCierre({ ahora });

    expect(mockPreview).toHaveBeenCalledWith({ desde: startOfGymDay(ahora), hasta: ahora });
    expect(r).toEqual({
      ...cierreFalso,
      desde: startOfGymDay(ahora).toISOString(),
      hasta: ahora.toISOString(),
    });
    expect(r.desde).toBe("2026-10-12T03:00:00.000Z");
    expect(r.hasta).toBe("2026-10-12T15:00:00.000Z");
  });

  it("expone el rango explícito cuando se envía", async () => {
    mockPreview.mockResolvedValueOnce(cierreFalso as never);
    const desde = new Date("2026-10-11T03:00:00.000Z");
    const hasta = new Date("2026-10-11T21:00:00.000Z");

    const r = await handlePrevisualizarCierre({ desde, hasta, ahora });

    expect(r.desde).toBe(desde.toISOString());
    expect(r.hasta).toBe(hasta.toISOString());
  });
});

describe("helpers de fetch del cliente", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetchPreviewCierre hace GET /api/cierres?preview=1", async () => {
    const preview = { totalRecaudado: 1200, cantidadOperaciones: 2 };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => preview });

    const r = await fetchPreviewCierre();

    expect(r).toEqual(preview);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cierres?preview=1",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("createCierre hace POST /api/cierres", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => cierreFalso });

    const r = await createCierre();

    expect(r).toEqual(cierreFalso);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cierres",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("createCierre envía el rango previsualizado en el body (CC-2)", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => cierreFalso });
    const rango = { desde: "2026-10-12T03:00:00.000Z", hasta: "2026-10-12T15:00:00.000Z" };

    await createCierre(rango);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cierres",
      expect.objectContaining({ method: "POST", body: JSON.stringify(rango) })
    );
  });

  it("fetchCierres hace GET /api/cierres", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => [] });

    const r = await fetchCierres();

    expect(r).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith("/api/cierres", expect.objectContaining({}));
  });
});
