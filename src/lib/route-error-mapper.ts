/**
 * Shared error mapping utility for all API route handlers
 * Maps error messages to HTTP response codes per spec
 */

export interface ErrorResponse {
  code: string;
  message: string;
  status: number;
}

export interface ErrorMapperOptions {
  /**
   * Custom message for FORBIDDEN errors
   * Each route has different role requirements:
   * - Ejercicios: ADMINISTRADOR or INSTRUCTOR
   * - Access-override: only ADMINISTRADOR
   * Default: "Se requiere rol de administrador"
   */
  forbiddenMessage?: string;

  /**
   * Resource name for NOT_FOUND errors
   * Used to construct message like "Ejercicio no encontrado" or "Socio no encontrado"
   * Default: "Recurso"
   */
  resourceName?: string;
}

/**
 * Map error messages to HTTP response codes per API spec
 * Shared across all route.ts files
 *
 * Supported error patterns (prefix: message):
 * - "Validación fallida: ..." or "VALIDATION_ERROR: ..." → 400 VALIDATION_ERROR
 * - "VALIDATION_DUPLICATE_DNI: ..." → 400 VALIDATION_DUPLICATE_DNI
 * - "VALIDATION_EMAIL_FORMAT: ..." → 400 VALIDATION_EMAIL_FORMAT
 * - "VALIDATION_REQUIRED: ..." → 400 VALIDATION_REQUIRED
 * - "MEMBERSHIP_NO_LONGER_ACTIVE: ..." → 400 MEMBERSHIP_NO_LONGER_ACTIVE
 * - "FORBIDDEN: ..." → 403 FORBIDDEN (with custom message per route)
 * - "NOT_FOUND: ..." → 404 NOT_FOUND (with resource-specific name)
 * - Other → 500 SERVER_ERROR
 *
 * @param error The error to map
 * @param options Optional configuration for FORBIDDEN and NOT_FOUND messages
 */
export function mapErrorToResponse(
  error: unknown,
  options: ErrorMapperOptions = {}
): ErrorResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const {
    forbiddenMessage = "Se requiere rol de administrador",
    resourceName = "Recurso",
  } = options;

  // Extract specific validation error codes (VALIDATION_XXX, MEMBERSHIP_XXX)
  const validationCodeMatch = message.match(
    /^(VALIDATION_[A-Z_]+|MEMBERSHIP_[A-Z_]+):\s*(.+)$/
  );
  if (validationCodeMatch) {
    const [, code, errorMessage] = validationCodeMatch;
    return {
      code,
      message: errorMessage,
      status: 400,
    };
  }

  // Legacy pattern: "Validación fallida: ..."
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
      message: forbiddenMessage,
      status: 403,
    };
  }

  if (message.includes("NOT_FOUND")) {
    return {
      code: "NOT_FOUND",
      message: `${resourceName} no encontrado`,
      status: 404,
    };
  }

  return {
    code: "SERVER_ERROR",
    message: "No se pudo procesar la solicitud",
    status: 500,
  };
}
