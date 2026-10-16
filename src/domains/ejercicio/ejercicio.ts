import type { Ejercicio } from "@prisma/client";

/**
 * Dominio PURO de Ejercicio: tipos, constantes, validación y helpers que no tocan la base.
 * El acceso a datos vive en `./ejercicio-repositorio` (`EjercicioRepository`), que recibe el
 * cliente por parámetro y lo carga de forma diferida. Este archivo NO debe referenciar
 * `@/lib/db` (ni de forma estática ni diferida): lo importan componentes del navegador.
 * El test guardián `src/domains/dominios-puros.guard.test.ts` lo verifica.
 */

/**
 * Canonical list of muscle groups (AC-002). This is the single source of truth:
 * the exercise form imports it instead of redefining its own copy.
 */
export const GRUPOS_MUSCULARES: string[] = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Brazos",
  "Abdomen",
];

export interface EjercicioInput {
  nombre: string;
  grupoMuscular: string;
  descripcion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create an ejercicio instance (domain model)
 * @param nombre Exercise name
 * @param grupoMuscular Muscle group
 * @param descripcion Optional description
 * @returns Ejercicio domain object
 */
export function createEjercicio(
  nombre: string,
  grupoMuscular: string,
  descripcion?: string
): Omit<Ejercicio, "id" | "createdAt" | "updatedAt"> {
  return {
    nombre,
    grupoMuscular,
    descripcion: descripcion || null,
  };
}

/**
 * Validate ejercicio input data
 * @param data Ejercicio input to validate
 * @returns Validation result with errors if any
 */
export function validateEjercicio(data: unknown): ValidationResult {
  const errors: string[] = [];

  // H-5: un body no-objeto (null/undefined/primitivo) no debe lanzar TypeError
  // (que el mapper convertiría en 500). Se devuelve inválido → 400.
  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Los datos del ejercicio son inválidos"] };
  }

  const input = data as Partial<EjercicioInput>;

  // Validate nombre
  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  if (!nombre) {
    errors.push("El nombre es requerido");
  } else if (nombre.length < 3) {
    errors.push("El nombre debe tener al menos 3 caracteres");
  } else if (nombre.length > 100) {
    errors.push("El nombre no puede exceder 100 caracteres");
  }

  // Validate grupoMuscular (AC-002: debe pertenecer a la lista predefinida)
  if (!input.grupoMuscular || typeof input.grupoMuscular !== "string") {
    errors.push("El grupo muscular es requerido");
  } else if (!GRUPOS_MUSCULARES.includes(input.grupoMuscular)) {
    errors.push(`El grupo muscular debe ser uno de: ${GRUPOS_MUSCULARES.join(", ")}`);
  }

  // Validate descripcion (optional)
  if (input.descripcion && typeof input.descripcion === "string") {
    if (input.descripcion.length > 500) {
      errors.push("La descripción no puede exceder 500 caracteres");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
