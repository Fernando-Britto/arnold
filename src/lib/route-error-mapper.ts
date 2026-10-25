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
 * Quita un prefijo `CODE: ` del mensaje para no exponer el código interno al
 * usuario. El código real viaja aparte en el campo `code` del envelope.
 */
function stripCodePrefix(message: string): string {
  return message.replace(/^[A-Z_]+:\s*/, "");
}

/**
 * Mensaje para un NOT_FOUND. Si el error trae el recurso en su mensaje
 * ("NOT_FOUND: Socio no encontrado") se usa ese texto, porque el dominio sabe qué
 * falta (SE-6). Si sólo dice "NOT_FOUND", cae al `resourceName` que pasa la ruta.
 */
function mensajeNotFound(message: string, resourceName: string): string {
  const detalle = stripCodePrefix(message).trim();
  if (!detalle || detalle.toUpperCase() === "NOT_FOUND") {
    return `${resourceName} no encontrado`;
  }
  return detalle;
}

/**
 * Map error messages to HTTP response codes per API spec
 * Shared across all route.ts files
 *
 * Supported error patterns (prefix: message):
 * - "Validación fallida: ..." or "VALIDATION_ERROR: ..." → 400 VALIDATION_ERROR
 * - "VALIDATION_MAX_EJERCICIOS: ..." → 400 VALIDATION_MAX_EJERCICIOS (AC-205)
 * - "VALIDATION_DUPLICATE_DNI: ..." → 400 VALIDATION_DUPLICATE_DNI
 * - "VALIDATION_EMAIL_FORMAT: ..." → 400 VALIDATION_EMAIL_FORMAT
 * - "VALIDATION_REQUIRED: ..." → 400 VALIDATION_REQUIRED
 * - "MEMBERSHIP_NO_LONGER_ACTIVE: ..." → 400 MEMBERSHIP_NO_LONGER_ACTIVE
 * - "DEACTIVATION_WARNING: ..." → 400 DEACTIVATION_WARNING (AC-005)
 * - "DELETE_BLOCKED_ASSIGNED: ..." → 409 DELETE_BLOCKED_ASSIGNED (AC-006)
 * - "DELETE_BLOCKED_EJERCICIOS: ..." → 409 DELETE_BLOCKED_EJERCICIOS (AC-011)
 * - "DELETE_BLOCKED_REFERENCES: ..." → 409 DELETE_BLOCKED_REFERENCES (PG-6/H2)
 * - "ESTADO_NO_ASIGNABLE: ..." → 400 ESTADO_NO_ASIGNABLE (AC-005)
 * - "DUPLICATE_NOMBRE_UBICACION: ..." → 409 DUPLICATE_NOMBRE_UBICACION (AC-006)
 * - "CASH_CLOSE_CONFLICT: ..." → 409 CASH_CLOSE_CONFLICT (cierre de caja duplicado)
 * - "PAYMENT_ALREADY_REGISTERED: ..." → 409 PAYMENT_ALREADY_REGISTERED (pago duplicado, PG-4)
 * - "PAYMENT_ALREADY_ANNULLED: ..." → 409 PAYMENT_ALREADY_ANNULLED (pago ya anulado, P-39)
 * - "AMOUNT_CHANGED: ..." → 409 AMOUNT_CHANGED (el monto esperado cambió, oferta de reactivación)
 * - Prisma "P2034" (fallo de serialización/deadlock) → 409 CASH_CLOSE_CONFLICT
 * - "PAYMENT_CONFLICT" → 409 PAYMENT_CONFLICT (choque de serialización al cobrar, PG-8)
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
  const code = (error as { code?: unknown } | null | undefined)?.code;
  const {
    forbiddenMessage = "Se requiere rol de administrador",
    resourceName = "Recurso",
  } = options;

  // Check if error has an explicit code property (for custom errors from handlers)
  if (code) {
    if (code === "DEACTIVATION_WARNING") {
      return {
        code: "DEACTIVATION_WARNING",
        message: stripCodePrefix(message),
        status: 400,
      };
    }
    if (code === "DELETE_BLOCKED_ASSIGNED") {
      return {
        code: "DELETE_BLOCKED_ASSIGNED",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    if (code === "DELETE_BLOCKED_EJERCICIOS") {
      return {
        code: "DELETE_BLOCKED_EJERCICIOS",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    // Más de MAX_EJERCICIOS_POR_MAQUINA (100) en una asignación (AC-205).
    if (code === "VALIDATION_MAX_EJERCICIOS") {
      return {
        code: "VALIDATION_MAX_EJERCICIOS",
        message: stripCodePrefix(message),
        status: 400,
      };
    }
    if (code === "ESTADO_NO_ASIGNABLE") {
      return {
        code: "ESTADO_NO_ASIGNABLE",
        message: stripCodePrefix(message),
        status: 400,
      };
    }
    if (code === "DUPLICATE_NOMBRE_UBICACION") {
      return {
        code: "DUPLICATE_NOMBRE_UBICACION",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    if (code === "DELETE_BLOCKED_REFERENCES") {
      return {
        code: "DELETE_BLOCKED_REFERENCES",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    // Cierre de caja duplicado: código explícito o fallo de serialización de Prisma
    // (P2034) cuando dos cierres concurrentes del mismo turno chocan.
    if (code === "CASH_CLOSE_CONFLICT" || code === "P2034") {
      return {
        code: "CASH_CLOSE_CONFLICT",
        message: "Ya existe un cierre de caja para el turno",
        status: 409,
      };
    }
    // PG-8: choque de serialización al REGISTRAR UN PAGO. Tiene su propio código y
    // mensaje para no reportarlo como "cierre de caja duplicado".
    if (code === "PAYMENT_CONFLICT") {
      return {
        code: "PAYMENT_CONFLICT",
        message: "Otro pago se registró al mismo tiempo; vuelva a intentarlo",
        status: 409,
      };
    }
    // Pago duplicado del mismo período (PG-4, anti doble-cobro): la cuota ya existe.
    if (code === "PAYMENT_ALREADY_REGISTERED") {
      return {
        code: "PAYMENT_ALREADY_REGISTERED",
        message: "Ya existe una cuota para el período que se intenta pagar",
        status: 409,
      };
    }
    // El pago ya estaba anulado: no se anula dos veces (P-39).
    if (code === "PAYMENT_ALREADY_ANNULLED") {
      return {
        code: "PAYMENT_ALREADY_ANNULLED",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    // El monto que vio el recepcionista ya no es el vigente (oferta de reactivación).
    if (code === "AMOUNT_CHANGED") {
      return {
        code: "AMOUNT_CHANGED",
        message: stripCodePrefix(message),
        status: 409,
      };
    }
    // Ejercicio repetido en la misma rutina (unique [rutinaId, ejercicioId], NF-11).
    if (code === "DUPLICATE_EXERCISE") {
      return {
        code: "DUPLICATE_EXERCISE",
        message: "El ejercicio ya está en la rutina",
        status: 409,
      };
    }
    // Dos asignaciones concurrentes chocaron bajo Serializable en RN-04 (NF-12).
    if (code === "ASIGNACION_CONFLICTO") {
      return {
        code: "ASIGNACION_CONFLICTO",
        message: "Otra asignación de rutina se procesó al mismo tiempo; vuelva a intentarlo",
        status: 409,
      };
    }
    if (code === "NOT_FOUND") {
      return {
        code: "NOT_FOUND",
        message: mensajeNotFound(message, resourceName),
        status: 404,
      };
    }
  }

  // Extract specific error codes from message prefix (VALIDATION_XXX, MEMBERSHIP_XXX, NOT_FOUND, etc.)
  const validationCodeMatch = message.match(
    /^(VALIDATION_MAX_EJERCICIOS|VALIDATION_[A-Z_]+|MEMBERSHIP_[A-Z_]+|DEACTIVATION_WARNING|DELETE_BLOCKED_ASSIGNED|DELETE_BLOCKED_EJERCICIOS|DELETE_BLOCKED_REFERENCES|ESTADO_NO_ASIGNABLE|DUPLICATE_NOMBRE_UBICACION|CASH_CLOSE_CONFLICT|PAYMENT_ALREADY_REGISTERED|PAYMENT_ALREADY_ANNULLED|AMOUNT_CHANGED|DUPLICATE_EXERCISE|ASIGNACION_CONFLICTO|NOT_FOUND):\s*(.+)$/
  );
  if (validationCodeMatch) {
    const [, errorCode, errorMessage] = validationCodeMatch;
    let status = 400;
    if (errorCode === "VALIDATION_MAX_EJERCICIOS") status = 400;
    if (errorCode === "DELETE_BLOCKED_ASSIGNED") status = 409;
    if (errorCode === "DELETE_BLOCKED_EJERCICIOS") status = 409;
    if (errorCode === "DELETE_BLOCKED_REFERENCES") status = 409;
    if (errorCode === "ESTADO_NO_ASIGNABLE") status = 400;
    if (errorCode === "DUPLICATE_NOMBRE_UBICACION") status = 409;
    if (errorCode === "CASH_CLOSE_CONFLICT") status = 409;
    if (errorCode === "PAYMENT_ALREADY_REGISTERED") status = 409;
    if (errorCode === "PAYMENT_ALREADY_ANNULLED") status = 409;
    if (errorCode === "AMOUNT_CHANGED") status = 409;
    if (errorCode === "DUPLICATE_EXERCISE") status = 409;
    if (errorCode === "ASIGNACION_CONFLICTO") status = 409;
    if (errorCode === "NOT_FOUND") status = 404;
    
    // For NOT_FOUND, keep the localized resourceName message (the generic contract).
    // An error that wants a resource-specific message sets `code: "NOT_FOUND"` and the
    // explicit-code branch above honors it (SE-6).
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

  // Error inesperado: al cliente va un mensaje genérico, pero el detalle real se
  // deja en el log del servidor (si no, un 500 no se puede diagnosticar).
  console.error(
    "[SERVER_ERROR]",
    describeUnexpectedError(error)
  );

  return {
    code: "SERVER_ERROR",
    message: "No se pudo procesar la solicitud",
    status: 500,
  };
}

/**
 * Texto de log para un error inesperado: mensaje, `code` y `meta` (Prisma) y stack.
 */
function describeUnexpectedError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { code, meta } = error as { code?: unknown; meta?: unknown };
  const parts = [error.message];
  if (code !== undefined) parts.push(`code=${String(code)}`);
  if (meta !== undefined) parts.push(`meta=${JSON.stringify(meta)}`);
  if (error.stack) parts.push(error.stack);
  return parts.join(" | ");
}
