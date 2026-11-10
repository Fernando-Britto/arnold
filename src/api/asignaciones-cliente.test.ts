import { fetchSugerencia } from "./asignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { RespuestaSugerencia } from "@/api/asignaciones";

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
});
