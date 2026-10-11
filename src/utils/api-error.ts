/**
 * Errores de la API del lado del cliente (T-023b).
 * `throwIfNotOk` convierte una respuesta no-ok en un ApiError con el `code` y el
 * `message` que manda el servidor (ver src/lib/route-error-mapper.ts), y
 * `handleApiError` decide qué texto ve la persona.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) return;
  let body: { code?: string; message?: string } = {};
  try {
    body = await response.json();
  } catch {
    // cuerpo vacío o que no es JSON: queda solo el status
  }
  throw new ApiError(response.status, body.message ?? `HTTP ${response.status}`, body.code);
}

const GENERIC = "Ocurrió un error inesperado.";

/**
 * Texto para mostrar. Los 4xx de validación muestran el mensaje del servidor;
 * 401, 403, 429, 5xx y los errores de red tienen texto propio (nunca se muestra
 * el detalle de un 5xx).
 */
export function handleApiError(error: unknown, fallback: string = GENERIC): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión venció. Iniciá sesión de nuevo.";
    if (error.status === 403) return "No tenés permiso para esta acción.";
    if (error.status === 429) return "Demasiados intentos. Esperá un momento y probá de nuevo.";
    if (error.status >= 500) return "No se pudo procesar la solicitud. Probá de nuevo más tarde.";
    return error.message;
  }
  if (error instanceof TypeError) return "No hay conexión con el servidor. Revisá tu internet.";
  return fallback;
}
