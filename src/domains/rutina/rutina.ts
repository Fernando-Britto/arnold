import { Prisma, Rutina as PrismaRutina, NivelDeDificultad } from "@prisma/client";
import { prisma } from "@/lib/db";

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

/**
 * Rutina Repository for database operations
 */
export class RutinaRepository {
  /**
    * Create a new rutina in the database.
    *
    * `client` defaults to the module Prisma client, but callers that must couple this
    * write with others (p. ej. `EjercicioEnRutina`) pass the transaction client `tx` so
    * both writes commit or roll back together.
    */
  async create(
    data: {
      nombre: string;
      frecuenciaSemanal: number;
      duracionEstimada: number;
      nivelDeDificultad: string;
      descripcion?: string | null;
      objetivoPrincipal?: string;
    },
    client: Prisma.TransactionClient = prisma
  ): Promise<PrismaRutina> {
    // Validate first
    const validation = validateRutina(data);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
    }

    // Create in database
    return client.rutina.create({
      data: {
        nombre: data.nombre,
        frecuenciaSemanal: data.frecuenciaSemanal,
        duracionEstimada: data.duracionEstimada,
        nivelDeDificultad: mapNivelDeDificultad(data.nivelDeDificultad),
        descripcion: data.descripcion,
        objetivoPrincipal: data.objetivoPrincipal || DEFAULT_OBJETIVO_PRINCIPAL,
      },
    });
  }

  /**
    * Retrieve a rutina by ID
    */
  async getById(id: string): Promise<PrismaRutina | null> {
    return prisma.rutina.findUnique({
      where: { id },
    });
  }

  /**
   * Update a rutina.
   *
   * `client` defaults to the module Prisma client; callers that synchronize the
   * exercises inside the same transaction pass `tx` so the read-for-validation, the
   * update and the exercise sync share one atomic boundary.
   */
  async update(
    id: string,
    data: Partial<{
      nombre: string;
      frecuenciaSemanal: number;
      duracionEstimada: number;
      nivelDeDificultad: string;
      descripcion: string | null;
      objetivoPrincipal: string | null;
    }>,
    client: Prisma.TransactionClient = prisma
  ): Promise<PrismaRutina | null> {
    // Validate if updating validation fields
    if (
      data.nombre !== undefined ||
      data.frecuenciaSemanal !== undefined ||
      data.duracionEstimada !== undefined ||
      data.nivelDeDificultad !== undefined ||
      data.objetivoPrincipal !== undefined
    ) {
      const current = await client.rutina.findUnique({ where: { id } });
      if (!current) return null;

      const merged = { ...current, ...data };
      const validation = validateRutina(merged);
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
      }
    }

    // Map nivel de dificultad if provided and filter out undefined null values
    // NF-14: contrato de campos opcionales: `undefined` = no cambiar, `null` = vaciar.
    // `descripcion` es nullable, así que un `null` explícito limpia la columna.
    const updateData: Record<string, any> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.frecuenciaSemanal !== undefined) updateData.frecuenciaSemanal = data.frecuenciaSemanal;
    if (data.duracionEstimada !== undefined) updateData.duracionEstimada = data.duracionEstimada;
    if (data.nivelDeDificultad !== undefined) updateData.nivelDeDificultad = mapNivelDeDificultad(data.nivelDeDificultad);
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.objetivoPrincipal !== undefined) updateData.objetivoPrincipal = data.objetivoPrincipal;

    return client.rutina.update({
      where: { id },
      data: updateData,
    });
  }

  /**
    * Delete a rutina
    */
  async delete(id: string): Promise<PrismaRutina> {
    return prisma.rutina.delete({
      where: { id },
    });
  }
}
