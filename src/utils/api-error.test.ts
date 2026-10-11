import { ApiError, throwIfNotOk, handleApiError } from "./api-error";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("throwIfNotOk", () => {
  it("no hace nada si la respuesta es ok", async () => {
    await expect(throwIfNotOk(jsonResponse(200, {}))).resolves.toBeUndefined();
  });

  it("lanza ApiError con status, code y message del servidor", async () => {
    const res = jsonResponse(400, { code: "VALIDATION_DUPLICATE_DNI", message: "DNI ya registrado" });
    await expect(throwIfNotOk(res)).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "VALIDATION_DUPLICATE_DNI",
      message: "DNI ya registrado",
    });
  });

  it("si el cuerpo no es JSON, igual lanza ApiError con el status", async () => {
    const res = {
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response;
    const error = await throwIfNotOk(res).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBeUndefined();
  });
});

describe("handleApiError", () => {
  it("un 4xx de validación muestra el mensaje del servidor", () => {
    const error = new ApiError(400, "El DNI ya está registrado", "VALIDATION_DUPLICATE_DNI");
    expect(handleApiError(error)).toBe("El DNI ya está registrado");
  });

  it("401: sesión vencida, sin importar el mensaje del servidor", () => {
    expect(handleApiError(new ApiError(401, "TOKEN_INVALID", "TOKEN_INVALID"))).toBe(
      "Tu sesión venció. Iniciá sesión de nuevo."
    );
  });

  it("403: sin permiso", () => {
    expect(handleApiError(new ApiError(403, "x", "FORBIDDEN"))).toBe(
      "No tenés permiso para esta acción."
    );
  });

  it("429: demasiados intentos", () => {
    expect(handleApiError(new ApiError(429, "x"))).toBe(
      "Demasiados intentos. Esperá un momento y probá de nuevo."
    );
  });

  it("5xx: mensaje genérico, nunca el detalle del servidor", () => {
    expect(handleApiError(new ApiError(500, "prisma exploded", "SERVER_ERROR"))).toBe(
      "No se pudo procesar la solicitud. Probá de nuevo más tarde."
    );
  });

  it("error de red (fetch rechazado con TypeError)", () => {
    expect(handleApiError(new TypeError("Failed to fetch"))).toBe(
      "No hay conexión con el servidor. Revisá tu internet."
    );
  });

  it("cualquier otra cosa usa el fallback recibido o el genérico", () => {
    expect(handleApiError("boom", "No se pudo guardar")).toBe("No se pudo guardar");
    expect(handleApiError(undefined)).toBe("Ocurrió un error inesperado.");
  });
});
