import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Map Spanish difficulty level names to Prisma enum values
 */
function mapNivelDeDificultad(nivel: string): "BASICO" | "INTERMEDIO" | "AVANZADO" {
  const map: Record<string, "BASICO" | "INTERMEDIO" | "AVANZADO"> = {
    "Básico": "BASICO",
    "Intermedio": "INTERMEDIO",
    "Avanzado": "AVANZADO",
  };
  return map[nivel] || "BASICO";
}

/**
 * Rutina domain model
 */
export interface Rutina {
  id: string;
  nombre: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: string;
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
    id: `rutina-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // Validate frecuenciaSemanal
  if (
    data.frecuenciaSemanal === undefined ||
    data.frecuenciaSemanal < 1 ||
    data.frecuenciaSemanal > 7
  ) {
    errors.push("La frecuencia semanal debe estar entre 1 y 7");
  }

  // Validate duracionEstimada
  if (!data.duracionEstimada || data.duracionEstimada <= 0) {
    errors.push("La duración estimada debe ser mayor a 0");
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
   * Create a new rutina in the database
   */
  async create(data: {
    nombre: string;
    frecuenciaSemanal: number;
    duracionEstimada: number;
    nivelDeDificultad: string;
    descripcion?: string;
    objetivoPrincipal?: string;
  }): Promise<any> {
    // Validate first
    const validation = validateRutina(data);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
    }

    // Create in database
    return prisma.rutina.create({
      data: {
        nombre: data.nombre,
        frecuenciaSemanal: data.frecuenciaSemanal,
        duracionEstimada: data.duracionEstimada,
        nivelDeDificultad: mapNivelDeDificultad(data.nivelDeDificultad),
        descripcion: data.descripcion,
        objetivoPrincipal: data.objetivoPrincipal || "General",
      },
    });
  }

  /**
   * Retrieve a rutina by ID
   */
  async getById(id: string): Promise<any | null> {
    return prisma.rutina.findUnique({
      where: { id },
    });
  }

  /**
   * Update a rutina
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
    }>
  ): Promise<any | null> {
    // Validate if updating validation fields
    if (
      data.nombre !== undefined ||
      data.frecuenciaSemanal !== undefined ||
      data.duracionEstimada !== undefined ||
      data.nivelDeDificultad !== undefined
    ) {
      const current = await prisma.rutina.findUnique({ where: { id } });
      if (!current) return null;

      const merged = { ...current, ...data };
      const validation = validateRutina(merged);
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
      }
    }

    // Map nivel de dificultad if provided and filter out undefined null values
    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.frecuenciaSemanal !== undefined) updateData.frecuenciaSemanal = data.frecuenciaSemanal;
    if (data.duracionEstimada !== undefined) updateData.duracionEstimada = data.duracionEstimada;
    if (data.nivelDeDificultad !== undefined) updateData.nivelDeDificultad = mapNivelDeDificultad(data.nivelDeDificultad);
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.objetivoPrincipal !== undefined) updateData.objetivoPrincipal = data.objetivoPrincipal;

    return prisma.rutina.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a rutina
   */
  async delete(id: string): Promise<any> {
    return prisma.rutina.delete({
      where: { id },
    });
  }
}
