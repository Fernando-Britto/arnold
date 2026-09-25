import { Ejercicio } from "@prisma/client";
import { ejercicioRepository, EjercicioInput } from "@/domains/ejercicio/ejercicio";

// Re-export types for route handlers
export type { Ejercicio, EjercicioInput };

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
 * Supports combined filters: both search and muscleGroup simultaneously
 */
export async function handleEjercicioList(options?: {
  muscleGroup?: string;
  search?: string;
}): Promise<Ejercicio[]> {
  // Support combined filters (search + muscleGroup)
  if (options?.search || options?.muscleGroup) {
    return ejercicioRepository.getAll(options);
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

/**
 * Client-side API call: fetch all ejercicios
 */
export async function fetchEjercicios(): Promise<Ejercicio[]> {
  const response = await fetch("/api/ejercicios");
  if (!response.ok) {
    throw new Error("Failed to fetch ejercicios");
  }
  return response.json();
}

/**
 * Client-side API call: create a new ejercicio
 */
export async function createEjercicio(data: EjercicioInput): Promise<Ejercicio> {
  const response = await fetch("/api/ejercicios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create ejercicio");
  }
  return response.json();
}

/**
 * Client-side API call: update an ejercicio
 */
export async function updateEjercicio(
  id: string,
  data: Partial<EjercicioInput>
): Promise<Ejercicio> {
  const response = await fetch(`/api/ejercicios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update ejercicio");
  }
  return response.json();
}

/**
 * Client-side API call: delete an ejercicio
 */
export async function deleteEjercicio(id: string): Promise<void> {
  const response = await fetch(`/api/ejercicios/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete ejercicio");
  }
}
