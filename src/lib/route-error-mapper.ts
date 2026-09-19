/**
 * Shared error mapping utility for all API route handlers
 * Maps error messages to HTTP response codes per spec
 */

export interface ErrorResponse {
  code: string;
  message: string;
  status: number;
}

/**
 * Map error messages to HTTP response codes per API spec
 * Shared across all route.ts files
 *
 * Error codes:
 * - "Validación fallida" → 400 VALIDATION_ERROR
 * - "FORBIDDEN" → 403 FORBIDDEN
 * - "NOT_FOUND" → 404 NOT_FOUND
 * - Other → 500 SERVER_ERROR
 */
export function mapErrorToResponse(error: unknown): ErrorResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.includes("Validación fallida")) {
    return {
      code: "VALIDATION_ERROR",
      message: message.replace("Validación fallida: ", ""),
      status: 400,
    };
  }

  if (message.includes("FORBIDDEN")) {
    return {
      code: "FORBIDDEN",
      message: "Se requiere rol de administrador",
      status: 403,
    };
  }

  if (message.includes("NOT_FOUND")) {
    return {
      code: "NOT_FOUND",
      message: "Recurso no encontrado",
      status: 404,
    };
  }

  return {
    code: "SERVER_ERROR",
    message: "No se pudo procesar la solicitud",
    status: 500,
  };
}
