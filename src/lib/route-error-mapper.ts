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
 * - "DEACTIVATION_WARNING: ..." → 400 DEACTIVATION_WARNING (AC-005)
 * - "DELETE_BLOCKED_ASSIGNED: ..." → 409 DELETE_BLOCKED_ASSIGNED (AC-006)
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
  const code = (error as any)?.code;
  const {
    forbiddenMessage = "Se requiere rol de administrador",
    resourceName = "Recurso",
  } = options;

  // Check if error has an explicit code property (for custom errors from handlers)
  if (code) {
    if (code === "DEACTIVATION_WARNING") {
      return {
        code: "DEACTIVATION_WARNING",
        message: message,
        status: 400,
      };
    }
    if (code === "DELETE_BLOCKED_ASSIGNED") {
      return {
        code: "DELETE_BLOCKED_ASSIGNED",
        message: message,
        status: 409,
      };
    }
    if (code === "NOT_FOUND") {
      return {
        code: "NOT_FOUND",
        message: `${resourceName} no encontrado`,
        status: 404,
      };
    }
  }

  // Extract specific error codes from message prefix (VALIDATION_XXX, MEMBERSHIP_XXX, NOT_FOUND, etc.)
  const validationCodeMatch = message.match(
    /^(VALIDATION_[A-Z_]+|MEMBERSHIP_[A-Z_]+|DEACTIVATION_WARNING|DELETE_BLOCKED_ASSIGNED|NOT_FOUND):\s*(.+)$/
  );
  if (validationCodeMatch) {
    const [, errorCode, errorMessage] = validationCodeMatch;
    let status = 400;
    if (errorCode === "DELETE_BLOCKED_ASSIGNED") status = 409;
    if (errorCode === "NOT_FOUND") status = 404;
    
    // For NOT_FOUND, use localized resourceName message instead of generic message
    const finalMessage = errorCode === "NOT_FOUND" ? `${resourceName} no encontrado` : errorMessage;
    
    return {
      code: errorCode,
      message: finalMessage,
      status,
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
