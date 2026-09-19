import { prisma } from "@/lib/db";
import { RequestWithUser } from "@/lib/auth";
import { canApproveAccessOverride } from "@/lib/fine-grained-auth";

/**
 * Access override request body
 */
export interface AccessOverrideRequest {
  motivo: string;
}

/**
 * Validation result for override requests
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate access override request
 */
export function validateAccessOverride(data: any): ValidationResult {
  const errors: string[] = [];

  // Validate motivo exists and is string
  if (!data.motivo || typeof data.motivo !== "string") {
    errors.push("La razón es requerida");
    return { valid: false, errors };
  }

  // Validate motivo is not empty or whitespace
  if (data.motivo.trim().length === 0) {
    errors.push("La razón no puede estar vacía");
  } else if (data.motivo.length < 10) {
    // Length check includes whitespace for UX clarity
    errors.push("La razón debe tener al menos 10 caracteres");
  } else if (data.motivo.length > 500) {
    errors.push("La razón no puede exceder 500 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Handle POST /api/socios/{socio_id}/access-override
 * Grant access override with mandatory reason and audit trail
 */
export async function handleAccessOverride(
  req: RequestWithUser,
  socioId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  // Validate ADMIN role
  if (!canApproveAccessOverride(req.user)) {
    throw new Error("FORBIDDEN: Rol de administrador requerido");
  }

  // Parse and validate request body
  const body = req.body as AccessOverrideRequest;
  const validation = validateAccessOverride(body);

  if (!validation.valid) {
    throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
  }

  // Verify socio exists
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    throw new Error("NOT_FOUND: Socio no encontrado");
  }

  // Create audit log
  await prisma.auditoriaAcceso.create({
    data: {
      usuario_id: req.user.id,
      socio_id: socioId,
      accion: "OVERRIDE_GRANT",
      motivo: body.motivo,
      resultado: "ALLOW",
      timestamp: new Date(),
      ip_address: req.ip || "0.0.0.0",
      user_agent: req.headers["user-agent"] || "unknown",
    },
  });

  // Create asistencia record
  await prisma.asistencia.create({
    data: {
      socio_id: socioId,
      timestamp: new Date(),
      motivo: null,
    },
  });

  return {
    success: true,
    message: "Acceso otorgado; registrado en auditoría",
  };
}

/**
 * Client-side API call: request access override
 */
export async function requestAccessOverride(
  socioId: string,
  motivo: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/socios/${socioId}/access-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "No se pudo otorgar acceso");
  }

  return response.json();
}
