import { decidirSugerencia, fetchSugerencia } from "./asignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { RespuestaSugerencia, RespuestaDecision } from "@/api/asignaciones";

const respuesta: RespuestaSugerencia = {
  socioId: "socio-1",
  sugerencia: {
    asignacionId: "a-1",
    ejercicioId: "e-1",
    ejercicioNombre: "Press inclinado",
    maquinaId: "m-1",
    maquinaNombre: "Banco plano",
    esperaSegundos: 0,
    ahorroSegundos: 120,
    creadaEn: "2026-11-05T12:00:00.000Z",
    venceEn: "2026-11-05T12:15:00.000Z",
  },
  siguienteEnOrden: null,
  calculadoEn: "2026-11-05T12:00:00.000Z",
};

function respuestaOk(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

const decision: RespuestaDecision = { accion: "ACEPTAR", sugerencia: respuesta.sugerencia, siguienteEnOrden: null };

function respuestaError(status: number, body: unknown): Response {
  return { ok: false, status, json: async () => body } as unknown as Response;
}

describe("asignaciones-cliente", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("lee la sugerencia con GET y devuelve el cuerpo tal cual", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaOk(respuesta));

    const resultado = await fetchSugerencia();

    expect(global.fetch).toHaveBeenCalledWith("/api/asignaciones/sugerencia", { signal: undefined });
    expect(resultado).toEqual(respuesta);
  });

  it("no fuerza credenciales: deja el default same-origin (la cookie de sesión viaja sola)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaOk(respuesta));

    await fetchSugerencia();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.credentials).toBeUndefined();
  });

  it("propaga el AbortSignal", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaOk(respuesta));
    const controlador = new AbortController();

    await fetchSugerencia(controlador.signal);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.signal).toBe(controlador.signal);
  });

  it("500 se convierte en ApiError 500 sin filtrar el detalle", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaError(500, { code: "SERVER_ERROR", message: "boom interno" }));

    const error = await fetchSugerencia().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
  });

  it("decide con POST y el body exacto { accion }", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaOk(decision));

    const resultado = await decidirSugerencia("ACEPTAR");

    expect(global.fetch).toHaveBeenCalledWith("/api/asignaciones/decidir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "ACEPTAR" }),
      signal: undefined,
    });
    expect(resultado).toEqual(decision);
  });

  it("envía ESPERAR sin campos extra", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respuestaOk({ ...decision, accion: "ESPERAR", sugerencia: null }));

    await decidirSugerencia("ESPERAR");

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ accion: "ESPERAR" });
  });

  it("404 SIN_SUGERENCIA se convierte en ApiError con código", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respuestaError(404, { code: "SIN_SUGERENCIA", message: "No hay una sugerencia vigente" })
    );

    await expect(decidirSugerencia("ACEPTAR")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "SIN_SUGERENCIA",
    });
  });

  it("409 SIN_SUGERENCIA_VIGENTE se convierte en ApiError 409", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respuestaError(409, { code: "SIN_SUGERENCIA_VIGENTE", message: "La sugerencia ya no está vigente; vuelva a consultar" })
    );

    const error = await decidirSugerencia("ACEPTAR").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("SIN_SUGERENCIA_VIGENTE");
  });
});
