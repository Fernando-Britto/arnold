/**
 * PG-7: la auth es por cookie; el patrón `getAuthHeaders()` que leía un token de
 * localStorage nunca tuvo un setter. Los fetches del cliente no deben enviar headers
 * de Authorization ni tocar localStorage (mismo criterio que P-14 en clientes.ts).
 */
import { fetchSocioPorDni } from "./socios";
import { createPago } from "./pagos";
import { fetchSesionEnCurso } from "./sesiones";
import { fetchPreviewCierre, createCierre, fetchCierres } from "./cierres";
import { checkIn } from "./acceso";
import { fetchRutinasDeSocio } from "./rutinas-asignadas";

const ok = () => ({ ok: true, json: async () => ({}) });

describe("PG-7: los fetches del cliente no usan tokens de localStorage", () => {
  let getItem: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    getItem = jest.spyOn(Storage.prototype, "getItem");
    global.fetch = jest.fn().mockResolvedValue(ok());
  });

  afterEach(() => {
    getItem.mockRestore();
  });

  it("GETs sin headers de auth (sin segundo argumento)", async () => {
    await fetchSocioPorDni("30123456");
    expect(global.fetch).toHaveBeenLastCalledWith("/api/socios?dni=30123456");

    await fetchSesionEnCurso();
    expect(global.fetch).toHaveBeenLastCalledWith("/api/sesiones?enCurso=1");

    await fetchPreviewCierre();
    expect(global.fetch).toHaveBeenLastCalledWith("/api/cierres?preview=1");

    await fetchCierres();
    expect(global.fetch).toHaveBeenLastCalledWith("/api/cierres");

    await fetchRutinasDeSocio("socio-1");
    expect(global.fetch).toHaveBeenLastCalledWith("/api/rutinas-asignadas?socioId=socio-1");
  });

  it("POSTs envían sólo Content-Type", async () => {
    await createPago({} as never);
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/pagos",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    );

    await createCierre();
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/cierres",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    );

    await checkIn({ dni: "30123456", pin: "1234" });
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/acceso/check-in",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    );
  });

  it("no lee localStorage", async () => {
    await fetchSocioPorDni("30123456");
    await fetchCierres();
    await fetchSesionEnCurso();
    await checkIn({ dni: "30123456", pin: "1234" });
    expect(getItem).not.toHaveBeenCalled();
  });
});
