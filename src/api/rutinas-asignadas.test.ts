/**
 * API layer de rutinas asignadas (T-034): handlers server-side y helpers de fetch del cliente.
 * El dominio va mockeado: acá se verifica que la capa API delegue y que los helpers de fetch
 * armen bien la petición (mismo patrón que src/api/pagos.test.ts).
 */
import {
  handleAsignarRutina,
  handleListarRutinasDeSocio,
  createAsignacionRutina,
  fetchRutinasDeSocio,
} from "./rutinas-asignadas";
import { asignarRutina, listarRutinasDeSocio } from "@/domains/rutina/asignar-rutina";

jest.mock("@/domains/rutina/asignar-rutina");

const mockAsignar = asignarRutina as jest.MockedFunction<typeof asignarRutina>;
const mockListar = listarRutinasDeSocio as jest.MockedFunction<typeof listarRutinasDeSocio>;

const asignacionFalsa = {
  id: "asig-1",
  socioId: "socio-1",
  rutinaId: "rutina-1",
  activa: true,
  rutina: { id: "rutina-1", nombre: "Full Body" },
};

describe("handleAsignarRutina", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el servicio de dominio con el input recibido", async () => {
    mockAsignar.mockResolvedValueOnce(asignacionFalsa as never);
    const input = { socioId: "socio-1", rutinaId: "rutina-1" };

    const r = await handleAsignarRutina(input);

    expect(r).toEqual(asignacionFalsa);
    expect(mockAsignar).toHaveBeenCalledWith(input);
  });
});

describe("handleListarRutinasDeSocio", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en el servicio que lista las asignaciones del socio", async () => {
    mockListar.mockResolvedValueOnce([] as never);

    const r = await handleListarRutinasDeSocio("socio-1");

    expect(r).toEqual([]);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});

describe("createAsignacionRutina (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/rutinas-asignadas con el cuerpo en JSON", async () => {
    const resultado = { success: true, rutinaAsignada: asignacionFalsa };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => resultado,
    });

    const r = await createAsignacionRutina({ socioId: "socio-1", rutinaId: "rutina-1" });

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rutinas-asignadas",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });
});

describe("fetchRutinasDeSocio (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace GET /api/rutinas-asignadas?socioId=... y devuelve la lista", async () => {
    const lista = [asignacionFalsa];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => lista,
    });

    const r = await fetchRutinasDeSocio("socio-1");

    expect(r).toEqual(lista);
    // PG-7: la sesión va en cookie; el fetch no adjunta headers.
    expect(global.fetch).toHaveBeenCalledWith("/api/rutinas-asignadas?socioId=socio-1");
  });
});
