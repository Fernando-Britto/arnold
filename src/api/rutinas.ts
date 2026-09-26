import { Rutina } from "@prisma/client";
import { RutinaRepository, validateRutina } from "@/domains/rutina/rutina";
import { prisma } from "@/lib/db";

export type RutinaWithCount = Rutina & { _count: { ejercicios: number } };

/**
 * Rutina input type for create operations
 */
export interface RutinaInput {
  nombre: string;
  objetivoPrincipal: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: string;
  descripcion?: string;
}

export interface EjercicioEnRutinaInput {
  ejercicioId: string;
  series: number;
  repeticiones: number;
  descanso: number;
  orden?: number;
}

/**
 * Handle POST /api/rutinas
 * Creates a new rutina with optional EjercicioEnRutina rows
 */
export async function handleRutinaCreate(
  data: RutinaInput & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const rutinaRepo = new RutinaRepository();
  const rutina = await rutinaRepo.create({
    nombre: data.nombre,
    frecuenciaSemanal: data.frecuenciaSemanal,
    duracionEstimada: data.duracionEstimada,
    nivelDeDificultad: data.nivelDeDificultad,
    descripcion: data.descripcion,
    objetivoPrincipal: data.objetivoPrincipal,
  });

  // Persist ejercicios if provided
  if (data.ejercicios && data.ejercicios.length > 0) {
    await prisma.ejercicioEnRutina.createMany({
      data: data.ejercicios.map((ej, index) => ({
        rutinaId: rutina.id,
        ejercicioId: ej.ejercicioId,
        series: Number(ej.series) || 3,
        repeticiones: Number(ej.repeticiones) || 10,
        descanso: Number(ej.descanso) || 60,
        orden: typeof ej.orden === "number" ? ej.orden : index,
      })),
    });
  }

  return rutina;
}

/**
 * Handle GET /api/rutinas
 * Lists all rutinas with exercise count (for ListPanel)
 */
export async function handleRutinaList(): Promise<RutinaWithCount[]> {
  return prisma.rutina.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { ejercicios: true } } },
  });
}

/**
 * Handle GET /api/rutinas/:id
 * Retrieves a single rutina by ID with exercises ordered
 */
export async function handleRutinaGet(
  id: string
): Promise<(Rutina & { ejercicios?: any[] }) | null> {
  return prisma.rutina.findUnique({
    where: { id },
    include: {
      ejercicios: {
        orderBy: {
          orden: "asc",
        },
      },
    },
  });
}

/**
 * Handle PUT /api/rutinas/:id
 * Updates a rutina and synchronizes EjercicioEnRutina rows if provided
 */
export async function handleRutinaUpdate(
  id: string,
  data: Partial<RutinaInput> & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina | null> {
  const rutinaRepo = new RutinaRepository();
  const rutina = await rutinaRepo.update(id, {
    nombre: data.nombre,
    frecuenciaSemanal: data.frecuenciaSemanal,
    duracionEstimada: data.duracionEstimada,
    nivelDeDificultad: data.nivelDeDificultad,
    descripcion: data.descripcion,
    objetivoPrincipal: data.objetivoPrincipal,
  });

  if (!rutina) return null;

  // Synchronize ejercicios if provided
  if (data.ejercicios !== undefined) {
    // Delete existing ejercicios for this rutina
    await prisma.ejercicioEnRutina.deleteMany({
      where: { rutinaId: id },
    });

    // Create new ejercicios if provided
    if (data.ejercicios.length > 0) {
      await prisma.ejercicioEnRutina.createMany({
        data: data.ejercicios.map((ej, index) => ({
          rutinaId: id,
          ejercicioId: ej.ejercicioId,
          series: Number(ej.series) || 3,
          repeticiones: Number(ej.repeticiones) || 10,
          descanso: Number(ej.descanso) || 60,
          orden: typeof ej.orden === "number" ? ej.orden : index,
        })),
      });
    }
  }

  return rutina;
}

/**
 * Handle DELETE /api/rutinas/:id
 * Deletes a rutina with cascade delete guard
 *
 * Business logic:
 * 1. Check if Rutina is assigned to any active Socio (RutinaAsignada.activa = true)
 * 2. If assigned: throw error "Rutina asignada activamente a N socio(s)"
 * 3. If not assigned: delete Rutina + all EjercicioEnRutina rows (Prisma cascade)
 */
export async function handleRutinaDelete(id: string): Promise<void> {
  // Check if rutina exists
  const rutina = await prisma.rutina.findUnique({ where: { id } });
  if (!rutina) {
    throw new Error("NOT_FOUND");
  }

  // Check for active assignments
  const activeAssignments = await prisma.rutinaAsignada.count({
    where: {
      rutinaId: id,
      activa: true,
    },
  });

  if (activeAssignments > 0) {
    throw new Error(
      `DELETE_BLOCKED_ASSIGNED: Rutina asignada activamente a ${activeAssignments} socio(s)`
    );
  }

  // Delete rutina (cascade deletes ejercicios)
  await prisma.rutina.delete({ where: { id } });
}

/**
 * Client-side API call: fetch all rutinas
 */
export async function fetchRutinas(): Promise<RutinaWithCount[]> {
  const response = await fetch("/api/rutinas");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch rutinas");
  }
  return response.json();
}

/**
 * Client-side API call: create a new rutina
 */
export async function createRutina(
  data: RutinaInput & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const response = await fetch("/api/rutinas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create rutina");
  }
  return response.json();
}

/**
 * Client-side API call: update a rutina
 */
export async function updateRutina(
  id: string,
  data: Partial<RutinaInput> & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const response = await fetch(`/api/rutinas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update rutina");
  }
  return response.json();
}

/**
 * Client-side API call: delete a rutina
 */
export async function deleteRutina(id: string): Promise<void> {
  const response = await fetch(`/api/rutinas/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete rutina");
  }
}
