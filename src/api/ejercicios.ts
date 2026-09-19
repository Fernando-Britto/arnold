import { Ejercicio } from "@prisma/client";
import { ejercicioRepository, EjercicioInput } from "@/domains/ejercicio/ejercicio";

/**
 * Handle POST /api/ejercicios
 * Creates a new ejercicio
 */
export async function handleEjercicioCreate(data: EjercicioInput): Promise<Ejercicio> {
  return ejercicioRepository.create(data);
}

/**
 * Handle GET /api/ejercicios
 * Lists all ejercicios with optional filtering
 */
export async function handleEjercicioList(options?: {
  muscleGroup?: string;
  search?: string;
}): Promise<Ejercicio[]> {
  if (options?.search) {
    return ejercicioRepository.searchByName(options.search);
  }

  if (options?.muscleGroup) {
    return ejercicioRepository.findByMuscleGroup(options.muscleGroup);
  }

  return ejercicioRepository.getAll();
}

/**
 * Handle GET /api/ejercicios/:id
 * Retrieves a single ejercicio by ID
 */
export async function handleEjercicioGet(id: string): Promise<Ejercicio | null> {
  return ejercicioRepository.getById(id);
}

/**
 * Handle PUT /api/ejercicios/:id
 * Updates an ejercicio
 */
export async function handleEjercicioUpdate(
  id: string,
  data: Partial<EjercicioInput>
): Promise<Ejercicio | null> {
  return ejercicioRepository.update(id, data);
}

/**
 * Handle DELETE /api/ejercicios/:id
 * Deletes an ejercicio
 */
export async function handleEjercicioDelete(id: string): Promise<boolean> {
  return ejercicioRepository.delete(id);
}

/**
 * Check if an ejercicio exists
 * @param id Ejercicio ID to check
 * @returns true if exists, false otherwise
 */
export async function ejercicioExists(id: string): Promise<boolean> {
  const ejercicio = await ejercicioRepository.getById(id);
  return ejercicio !== null;
}

/**
 * Get total count of ejercicios
 * @returns Total number of ejercicios
 */
export async function getEjercicioCount(): Promise<number> {
  return ejercicioRepository.count();
}
