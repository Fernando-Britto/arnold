import { Ejercicio } from "@prisma/client";
import { throwIfNotOk } from "@/utils/api-error";
import { CLAVES, conCache, invalidarCache } from "@/lib/cache-cliente";
import { EjercicioInput, type EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { ejercicioRepository } from "@/domains/ejercicio/ejercicio-repositorio";

// Re-export types for route handlers
export type { Ejercicio, EjercicioInput, EjercicioConUso };

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
  limit?: number;
  offset?: number;
}): Promise<EjercicioConUso[]> {
  // Se propagan SIEMPRE: el cortocircuito anterior descartaba limit/offset cuando
  // sólo llegaba paginación, sin search ni muscleGroup.
  return ejercicioRepository.getAll(options);
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
 * Client-side API call: fetch all ejercicios
 */
export function fetchEjercicios(): Promise<EjercicioConUso[]> {
  return conCache(CLAVES.ejercicios, async () => {
    const response = await fetch("/api/ejercicios");
    await throwIfNotOk(response, "No se pudieron cargar los ejercicios");
    return response.json();
  });
}

/**
 * Client-side API call: búsqueda paginada para el modal de asignación.
 * Sin `conCache`: la búsqueda cambia en cada tecla y debe pegarle siempre al servidor.
 */
export async function fetchEjerciciosBusqueda(params: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<EjercicioConUso[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const suffix = query.toString();
  const response = await fetch(`/api/ejercicios${suffix ? `?${suffix}` : ""}`);
  await throwIfNotOk(response, "No se pudieron buscar los ejercicios");
  return response.json();
}

/**
 * Client-side API call: un ejercicio completo, con sus instrucciones (el listado no las trae, D-70).
 */
export async function fetchEjercicio(id: string): Promise<Ejercicio> {
  const response = await fetch(`/api/ejercicios/${id}`);
  await throwIfNotOk(response, "No se pudo cargar el ejercicio");
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
  await throwIfNotOk(response, "No se pudo crear el ejercicio");
  invalidarCache(CLAVES.ejercicios);
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
  await throwIfNotOk(response, "No se pudo actualizar el ejercicio");
  invalidarCache(CLAVES.ejercicios);
  return response.json();
}

/**
 * Client-side API call: delete an ejercicio
 */
export async function deleteEjercicio(id: string): Promise<void> {
  const response = await fetch(`/api/ejercicios/${id}`, {
    method: "DELETE",
  });
  await throwIfNotOk(response, "No se pudo eliminar el ejercicio");
  invalidarCache(CLAVES.ejercicios);
}
