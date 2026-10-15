/**
 * Capa API de configuración (T-043c): helpers de fetch del cliente.
 * Se verifica que armen bien la petición y que propaguen el error del servidor.
 */
import { ApiError } from "@/utils/api-error";
import type { Configuracion } from "@/lib/configuracion";
import { fetchConfiguracion, guardarConfiguracion } from "./configuracion";

const config: Configuracion = {
  capacidadMaxima: 100,
  periodoGracia: 5,
  diasInactividad: 15,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  descuentoReactivacion: 10,
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
};

describe("fetchConfiguracion (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace GET /api/configuracion y devuelve la configuración", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => config,
    });

    const r = await fetchConfiguracion();

    expect(r).toEqual(config);
    expect(global.fetch).toHaveBeenCalledWith("/api/configuracion");
  });

  it("lanza ApiError con el mensaje del servidor cuando la respuesta no es ok", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: "FORBIDDEN", message: "Se requiere rol de administrador" }),
    });

    await expect(fetchConfiguracion()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("guardarConfiguracion (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace PUT /api/configuracion con los cambios en JSON", async () => {
    const actualizada = { ...config, periodoGracia: 7 };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => actualizada,
    });

    const r = await guardarConfiguracion({ periodoGracia: 7 });

    expect(r).toEqual(actualizada);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/configuracion",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ periodoGracia: 7 }),
      })
    );
  });

  it("lanza ApiError cuando la respuesta no es ok", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        code: "VALIDATION_ERROR",
        message: "capacidadMaxima debe estar entre 1 y 10000",
      }),
    });

    await expect(guardarConfiguracion({ capacidadMaxima: 99999 })).rejects.toBeInstanceOf(ApiError);
  });
});
