import { Ejercicio } from "@prisma/client";

/**
 * Import diferido del cliente Prisma: el dominio no debe tener un edge ESTÁTICO con la
 * infraestructura (`@/lib/db`). Mismo patrón que `src/lib/configuracion.ts`.
 *
 * PENDIENTE: esto NO vuelve puro al módulo. El refactor que falta es inyectar el cliente
 * (como `ConfiguracionReader`/`OfertaReader`) y sacar el acceso a datos de `src/domains`.
 */
async function getPrisma() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

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
export function validateEjercicio(data: any): ValidationResult {
  const errors: string[] = [];

  // H-5: un body no-objeto (null/undefined/primitivo) no debe lanzar TypeError
  // (que el mapper convertiría en 500). Se devuelve inválido → 400.
  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Los datos del ejercicio son inválidos"] };
  }

  // Validate nombre
  const nombre = typeof data.nombre === "string" ? data.nombre.trim() : "";
  if (!nombre) {
    errors.push("El nombre es requerido");
  } else if (nombre.length < 3) {
    errors.push("El nombre debe tener al menos 3 caracteres");
  } else if (nombre.length > 100) {
    errors.push("El nombre no puede exceder 100 caracteres");
  }

  // Validate grupoMuscular (AC-002: debe pertenecer a la lista predefinida)
  if (!data.grupoMuscular || typeof data.grupoMuscular !== "string") {
    errors.push("El grupo muscular es requerido");
  } else if (!GRUPOS_MUSCULARES.includes(data.grupoMuscular)) {
    errors.push(`El grupo muscular debe ser uno de: ${GRUPOS_MUSCULARES.join(", ")}`);
  }

  // Validate descripcion (optional)
  if (data.descripcion && typeof data.descripcion === "string") {
    if (data.descripcion.length > 500) {
      errors.push("La descripción no puede exceder 500 caracteres");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mensaje del bloqueo por clave foránea al borrar un ejercicio (H11). Prisma informa en
 * `error.meta` la relación que restringe (el nombre del constraint contiene el modelo):
 * `EjercicioEnRutina` (está en rutinas) o `RegistroDeProgreso` (tiene historial). Si el
 * meta falta o no se reconoce, el mensaje cubre las dos relaciones posibles.
 */
function mensajeBloqueoPorRelacion(error: { meta?: unknown } | null | undefined): string {
  const meta = JSON.stringify(error?.meta ?? "");
  if (/EjercicioEnRutina/.test(meta)) {
    return "No se puede eliminar el ejercicio porque está asignado a una o más rutinas";
  }
  if (/RegistroDeProgreso/.test(meta)) {
    return "No se puede eliminar el ejercicio porque tiene historial de entrenamiento";
  }
  return "No se puede eliminar el ejercicio porque está en uso";
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
      throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
    }

    const prisma = await getPrisma();
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
    const prisma = await getPrisma();
    return prisma.ejercicio.findUnique({
      where: { id },
    });
  }

  /**
   * Get all ejercicios with optional filtering
   * Supports combined filters: search + muscleGroup simultaneously
   * @param options Optional filter options { muscleGroup?: string; search?: string }
   * @returns Array of ejercicios matching filters
   */
  async getAll(options?: { muscleGroup?: string; search?: string }): Promise<Ejercicio[]> {
    const prisma = await getPrisma();
    const where: any = {};
    
    if (options?.muscleGroup) {
      where.grupoMuscular = options.muscleGroup;
    }
    
    if (options?.search) {
      // H12: `contains` + `insensitive` es el `ILIKE` de Postgres: pliega mayúsculas,
      // pero NO tildes ("triceps" no matchea "Tríceps"). Plegar tildes en la base exige
      // la extensión `unaccent` o una columna normalizada (cambio de schema, fuera de
      // alcance). La búsqueda de la pantalla de ejercicios filtra en el cliente con
      // `normalizeSortText`, así que este filtro server-side queda sólo case-insensitive.
      where.nombre = {
        contains: options.search,
        mode: "insensitive",
      };
    }

    return prisma.ejercicio.findMany({
      where,
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
    // H-6: la lectura de validación y la escritura van en UNA sola transacción
    // para eliminar la ventana TOCTOU del read-then-write.
    const prisma = await getPrisma();
    return prisma.$transaction(async (tx) => {
      const currentEjercicio = await tx.ejercicio.findUnique({ where: { id } });
      if (!currentEjercicio) return null;

      // Merge current data with updates to validate complete record
      const updateData = {
        ...currentEjercicio,
        ...data,
      };

      // Validate merged data (ensures no invalid partial updates)
      const validation = validateEjercicio(updateData);
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
      }

      return tx.ejercicio.update({
        where: { id },
        data: {
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.grupoMuscular !== undefined && { grupoMuscular: data.grupoMuscular }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
        },
      });
    });
  }

  /**
   * Delete an ejercicio
   * @param id Ejercicio ID
   * @returns true if deleted, false if not found
   * @throws Error if ejercicio is in use (DELETE_BLOCKED_ASSIGNED)
   */
  async delete(id: string): Promise<boolean> {
    const prisma = await getPrisma();
    try {
      await prisma.ejercicio.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      // P2003: falla de clave foránea. Al ejercicio lo referencian DOS relaciones con
      // onDelete: Restrict: `EjercicioEnRutina.ejercicio` (asignado a rutinas) y
      // `RegistroDeProgreso.ejercicio` (historial de entrenamiento). Prisma informa cuál
      // en `error.meta` (nombre del constraint/campo), así que el mensaje se elige según
      // la relación (H11); sin meta reconocible, cae a un mensaje que cubre las dos.
      if (error?.code === "P2003" || error?.message?.includes("foreign key")) {
        throw Object.assign(
          new Error(`DELETE_BLOCKED_ASSIGNED: ${mensajeBloqueoPorRelacion(error)}`),
          { code: "DELETE_BLOCKED_ASSIGNED" }
        );
      }
      // P2025: record not found → false (404 handled by the caller).
      if (error?.code === "P2025") {
        return false;
      }
      // H-3: cualquier otro fallo es de infraestructura y debe propagarse (→ 500),
      // no enmascararse como "no encontrado".
      throw error;
    }
  }

  /**
   * Count total ejercicios
   * @returns Total count
   */
  async count(): Promise<number> {
    const prisma = await getPrisma();
    return prisma.ejercicio.count();
  }
}

/**
 * Export a singleton repository instance
 */
export const ejercicioRepository = new EjercicioRepository();
