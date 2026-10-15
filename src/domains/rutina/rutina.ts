import { NivelDeDificultad } from "@prisma/client";

/**
 * Dominio PURO de Rutina: tipos, constantes, mapeo de nivel y validación, sin acceso a datos.
 * El repositorio vive en `./rutina-repositorio` (`RutinaRepository`), que recibe el cliente por
 * parámetro y lo carga de forma diferida. Este archivo NO debe referenciar `@/lib/db`: lo importa
 * el formulario de rutinas (`src/components/rutina-crud/rutina-form.tsx`), que llega al navegador.
 * El test guardián `src/domains/dominios-puros.guard.test.ts` lo verifica.
 */

/**
 * Canonical list of training objectives (NF-4). Single source of truth: the
 * rutina form imports it instead of redefining its own copy.
 */
export const OBJETIVOS_PRINCIPALES: string[] = [
  "Hipertrofia",
  "Fuerza",
  "Resistencia",
  "Pérdida de Peso",
  "Acondicionamiento General",
];

/**
 * Default objective used when none is provided. Must be a member of
 * `OBJETIVOS_PRINCIPALES` so the stored value is always valid.
 */
export const DEFAULT_OBJETIVO_PRINCIPAL = "Acondicionamiento General";

/**
 * Valores legados aceptados sólo por compatibilidad (U9a): el default viejo del
 * servidor era "General", así que las filas existentes con ese valor deben seguir
 * pudiendo editarse. No se ofrecen para altas nuevas.
 */
export const OBJETIVOS_LEGACY: string[] = ["General"];

/**
 * Map Spanish difficulty level names or enum values to Prisma enum
 */
export function mapNivelDeDificultad(nivel: string): NivelDeDificultad {
  const map: Record<string, NivelDeDificultad> = {
    "Básico": NivelDeDificultad.BASICO,
    "Intermedio": NivelDeDificultad.INTERMEDIO,
    "Avanzado": NivelDeDificultad.AVANZADO,
    "BASICO": NivelDeDificultad.BASICO,
    "INTERMEDIO": NivelDeDificultad.INTERMEDIO,
    "AVANZADO": NivelDeDificultad.AVANZADO,
  };
  return map[nivel] || NivelDeDificultad.BASICO;
}

/**
 * Rutina domain model
 */
export interface Rutina {
  id: string;
  nombre: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: NivelDeDificultad | string;
  descripcion?: string | null;
  objetivoPrincipal?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create a Rutina with required fields
 */
export function createRutina(
  nombre: string,
  frecuenciaSemanal: number,
  duracionEstimada: number,
  nivelDeDificultad: string,
  descripcion?: string,
  objetivoPrincipal?: string
): Rutina {
  return {
    id: `rutina-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    nombre,
    frecuenciaSemanal,
    duracionEstimada,
    nivelDeDificultad,
    descripcion,
    objetivoPrincipal,
  };
}

/**
 * Validate a Rutina object
 */
export function validateRutina(data: Partial<Rutina>): ValidationResult {
  const errors: string[] = [];

  // Validate nombre
  if (!data.nombre || data.nombre.trim() === "") {
    errors.push("El nombre es requerido");
  } else if (data.nombre.length < 3) {
    errors.push("El nombre debe tener al menos 3 caracteres");
  } else if (data.nombre.length > 100) {
    errors.push("El nombre no puede exceder 100 caracteres");
  }

  // Validate frecuenciaSemanal (NF-10: debe ser entero, Prisma lo persiste como Int)
  if (
    data.frecuenciaSemanal === undefined ||
    !Number.isInteger(data.frecuenciaSemanal) ||
    data.frecuenciaSemanal < 1 ||
    data.frecuenciaSemanal > 7
  ) {
    errors.push("La frecuencia semanal debe estar entre 1 y 7");
  }

  // Validate duracionEstimada (NF-10: debe ser entero, Prisma lo persiste como Int)
  if (
    !data.duracionEstimada ||
    !Number.isInteger(data.duracionEstimada) ||
    data.duracionEstimada <= 0
  ) {
    errors.push("La duración estimada debe ser mayor a 0");
  }

  // Validate objetivoPrincipal (NF-4, NF-13): si viene, debe pertenecer a la lista.
  // Se acepta además el valor legado "General" (U9a) para no romper la edición de filas viejas.
  // NF-13: `null` y `""` NO significan "volver al default": son inválidos y se rechazan
  // (la columna es NOT NULL). Omitirlo (`undefined`) sigue permitido: en create toma el
  // default y en update deja el valor actual sin tocar.
  if (
    data.objetivoPrincipal === null ||
    data.objetivoPrincipal === "" ||
    (data.objetivoPrincipal !== undefined &&
      !OBJETIVOS_PRINCIPALES.includes(data.objetivoPrincipal) &&
      !OBJETIVOS_LEGACY.includes(data.objetivoPrincipal))
  ) {
    errors.push(`El objetivo principal debe ser uno de: ${OBJETIVOS_PRINCIPALES.join(", ")}`);
  }

  // Validate nivelDeDificultad (accept both Spanish names and enum values)
  const validLevels = ["Básico", "Intermedio", "Avanzado", "BASICO", "INTERMEDIO", "AVANZADO"];
  if (!validLevels.includes(data.nivelDeDificultad || "")) {
    errors.push("El nivel de dificultad debe ser uno de: Básico, Intermedio, Avanzado");
  }

  // Validate descripcion (optional)
  if (data.descripcion && data.descripcion.length > 500) {
    errors.push("La descripción no puede exceder 500 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
