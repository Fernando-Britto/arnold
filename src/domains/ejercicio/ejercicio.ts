import { prisma } from "@/lib/db";
import { Ejercicio } from "@prisma/client";

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
export function validateEjercicio(data: any): ValidationResult {
  const errors: string[] = [];

  // Validate nombre
  if (!data.nombre || typeof data.nombre !== "string") {
    errors.push("Nombre is required");
  } else if (data.nombre.length < 3) {
    errors.push("Nombre must be at least 3 characters");
  } else if (data.nombre.length > 100) {
    errors.push("Nombre cannot exceed 100 characters");
  }

  // Validate grupoMuscular
  if (!data.grupoMuscular || typeof data.grupoMuscular !== "string") {
    errors.push("Grupo muscular is required");
  }

  // Validate descripcion (optional)
  if (data.descripcion && typeof data.descripcion === "string") {
    if (data.descripcion.length > 500) {
      errors.push("Descripción cannot exceed 500 characters");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Repository for Ejercicio domain operations
 * Handles persistence and retrieval from the database
 */
export class EjercicioRepository {
  /**
   * Create a new ejercicio
   * @param data Ejercicio input
   * @returns Created ejercicio with ID
   * @throws Error if validation fails
   */
  async create(data: EjercicioInput): Promise<Ejercicio> {
    const validation = validateEjercicio(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    return prisma.ejercicio.create({
      data: {
        nombre: data.nombre,
        grupoMuscular: data.grupoMuscular,
        descripcion: data.descripcion || null,
      },
    });
  }

  /**
   * Get ejercicio by ID
   * @param id Ejercicio ID
   * @returns Ejercicio or null if not found
   */
  async getById(id: string): Promise<Ejercicio | null> {
    return prisma.ejercicio.findUnique({
      where: { id },
    });
  }

  /**
   * Get all ejercicios
   * @returns Array of all ejercicios
   */
  async getAll(): Promise<Ejercicio[]> {
    return prisma.ejercicio.findMany({
      orderBy: { nombre: "asc" },
    });
  }

  /**
   * Update an ejercicio
   * @param id Ejercicio ID
   * @param data Partial ejercicio data to update
   * @returns Updated ejercicio or null if not found
   */
  async update(
    id: string,
    data: Partial<EjercicioInput>
  ): Promise<Ejercicio | null> {
    // Validate only if changing nombre or grupoMuscular
    if (data.nombre || data.grupoMuscular) {
      const currentEjercicio = await this.getById(id);
      if (!currentEjercicio) return null;

      const updateData = {
        ...currentEjercicio,
        ...data,
      };

      const validation = validateEjercicio(updateData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }
    }

    return prisma.ejercicio.update({
      where: { id },
      data: {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.grupoMuscular && { grupoMuscular: data.grupoMuscular }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
      },
    });
  }

  /**
   * Delete an ejercicio
   * @param id Ejercicio ID
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.ejercicio.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find ejercicios by muscle group
   * @param grupoMuscular Muscle group to filter by
   * @returns Array of matching ejercicios
   */
  async findByMuscleGroup(grupoMuscular: string): Promise<Ejercicio[]> {
    return prisma.ejercicio.findMany({
      where: { grupoMuscular },
      orderBy: { nombre: "asc" },
    });
  }

  /**
   * Search ejercicios by name
   * @param query Search query (partial name match)
   * @returns Array of matching ejercicios
   */
  async searchByName(query: string): Promise<Ejercicio[]> {
    return prisma.ejercicio.findMany({
      where: {
        nombre: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: { nombre: "asc" },
    });
  }

  /**
   * Count total ejercicios
   * @returns Total count
   */
  async count(): Promise<number> {
    return prisma.ejercicio.count();
  }
}

/**
 * Export a singleton repository instance
 */
export const ejercicioRepository = new EjercicioRepository();
