import { Rutina } from "@prisma/client";
import { RutinaRepository, validateRutina } from "@/domains/rutina/rutina";
import { prisma } from "@/lib/db";

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

/**
 * Handle POST /api/rutinas
 * Creates a new rutina with optional EjercicioEnRutina rows
 */
export async function handleRutinaCreate(data: RutinaInput & { ejercicios?: any[] }): Promise<Rutina> {
  const rutinaRepo = new RutinaRepository();
  return rutinaRepo.create({
    nombre: data.nombre,
    frecuenciaSemanal: data.frecuenciaSemanal,
    duracionEstimada: data.duracionEstimada,
    nivelDeDificultad: data.nivelDeDificultad,
    descripcion: data.descripcion,
    objetivoPrincipal: data.objetivoPrincipal,
  });
}

/**
 * Handle GET /api/rutinas
 * Lists all rutinas
 */
export async function handleRutinaList(): Promise<Rutina[]> {
  return prisma.rutina.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Handle GET /api/rutinas/:id
 * Retrieves a single rutina by ID
 */
export async function handleRutinaGet(id: string): Promise<Rutina | null> {
  return prisma.rutina.findUnique({
    where: { id },
  });
}

/**
 * Handle PUT /api/rutinas/:id
 * Updates a rutina
 */
export async function handleRutinaUpdate(
  id: string,
  data: Partial<RutinaInput>
): Promise<Rutina | null> {
  const rutinaRepo = new RutinaRepository();
  return rutinaRepo.update(id, data);
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

  // Check if rutina is assigned to any active socio
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

  // Safe to delete: Prisma cascade will delete EjercicioEnRutina rows
  await prisma.rutina.delete({ where: { id } });
}
