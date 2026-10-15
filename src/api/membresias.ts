import { validateMembresia, type Membresia as MembresiaDomain, type EstadoMembresia } from "@/domains/membresia/membresia";
import { MembresiaRepository } from "@/domains/membresia/membresia";
import { throwIfNotOk } from "@/utils/api-error";

/** Error de negocio con código para el route handler (en lugar de `as any`). */
type CodedError = Error & { code?: string; assignedCount?: number };

/**
 * Client-side API interface for Membresía (matches domain but adds assignedSocioCount)
 */
export interface Membresia extends MembresiaDomain {
  assignedSocioCount: number;
}

export interface MembresiaInput {
  nombre?: string;
  precio?: number;
  periodicidad?: number;
  /**
   * NF-14: `undefined` = no cambiar; `null` = vaciar la descripción (columna nullable).
   * El formulario manda `null` explícito al borrar el texto.
   */
  descripcion?: string | null;
  estado?: EstadoMembresia;
  confirmarDesactivacion?: boolean;
}

/**
 * Server-side handler for POST /api/membresias
 * Creates a new membresía with validation
 */
export async function handleMembresiaCreate(
  input: MembresiaInput
): Promise<Membresia> {
  // Validate input
  const validation = validateMembresia(input);
  if (!validation.valid) {
    const error = new Error(`VALIDATION_ERROR: ${validation.errors[0] || "Validation failed"}`);
    (error as CodedError).code = "VALIDATION_ERROR";
    throw error;
  }

  // Create in database
  const repository = new MembresiaRepository();
  const created = await repository.create({
    nombre: input.nombre!,
    precio: input.precio!,
    periodicidad: input.periodicidad!,
    descripcion: input.descripcion,
    estado: input.estado!,
  });

  return {
    ...created,
    assignedSocioCount: 0, // New membresía has no assigned members
  };
}

/**
 * Server-side handler for GET /api/membresias
 * Returns list of all membresias with assigned member counts
 */
/**
 * Server-side handler for GET /api/membresias
 * Returns list of all membresias (or only active ones) with assigned member counts
 */
export async function handleMembresiaList(
  options: { activeOnly?: boolean } = {}
): Promise<Membresia[]> {
  const repository = new MembresiaRepository();
  // Single query: the repository resolves every `assignedSocioCount` through
  // Prisma `_count`, so the list no longer runs one `count` per membresía (N+1).
  return repository.getAllWithAssignedCounts(options.activeOnly ?? false);
}

/**
 * Server-side handler for GET /api/membresias/activas
 * Read-only lookup for the Clientes "Membresía asignada" dropdown (AC-004).
 * Deliberately separate from /api/membresias so the Recepcionista can read the
 * active plans without gaining access to Membresías management (RN-06): no
 * description, no periodicity, no assigned-member counts.
 */
export async function handleMembresiasActivas(): Promise<MembresiaDropdown[]> {
  const repository = new MembresiaRepository();
  const activas = await repository.getAllActivas();
  return activas.map(({ id, nombre, precio, estado }) => ({ id, nombre, precio, estado }));
}

/**
 * Server-side handler for GET /api/membresias/[id]
 * Returns single membresia with assigned member count
 */
export async function handleMembresiaGetById(id: string): Promise<Membresia> {
  const repository = new MembresiaRepository();
  const membresia = await repository.getById(id);

  if (!membresia) {
    const error = new Error("NOT_FOUND: Membresía no encontrada");
    (error as CodedError).code = "NOT_FOUND";
    throw error;
  }

  const assignedSocioCount = await repository.getAssignedSocioCount(id);
  return {
    ...membresia,
    assignedSocioCount,
  };
}

/**
 * Server-side handler for PUT /api/membresias/[id]
 * Updates a membresia with validation
 */
export async function handleMembresiaUpdate(
  id: string,
  input: MembresiaInput
): Promise<Membresia> {
  // Get existing membresia first
  const repository = new MembresiaRepository();
  const existing = await repository.getById(id);

  if (!existing) {
    const error = new Error("NOT_FOUND: Membresía no encontrada");
    (error as CodedError).code = "NOT_FOUND";
    throw error;
  }

  // Merge with existing data.
  // NF-14: `descripcion` conserva el `null` explícito (vaciar); no se colapsa a
  // `undefined`, que significaría "no cambiar".
  const merged = {
    nombre: input.nombre ?? existing.nombre,
    precio: input.precio ?? existing.precio,
    periodicidad: input.periodicidad ?? existing.periodicidad,
    descripcion: input.descripcion !== undefined ? input.descripcion : existing.descripcion,
    estado: input.estado ?? existing.estado,
  };

  // Validate merged data
  const validation = validateMembresia(merged);
  if (!validation.valid) {
    const error = new Error(`VALIDATION_ERROR: ${validation.errors[0] || "Validation failed"}`);
    (error as CodedError).code = "VALIDATION_ERROR";
    throw error;
  }

  // Check deactivation warning (AC-005): requires explicit confirmation if socios assigned
  if (input.estado === "INACTIVA" && existing.estado === "ACTIVA") {
    const assignedCount = await repository.getAssignedSocioCount(id);
    if (assignedCount > 0 && input.confirmarDesactivacion !== true) {
      // Warn but don't block — require explicit confirmation
      const error = new Error(`DEACTIVATION_WARNING: ${assignedCount} socios tienen esta membresía asignada`);
      (error as CodedError).code = "DEACTIVATION_WARNING";
      (error as CodedError).assignedCount = assignedCount;
      throw error;
    }
    // If confirmarDesactivacion === true, allow the deactivation to proceed
  }

  // Update in database
  const updated = await repository.update(id, merged);

  const assignedSocioCount = await repository.getAssignedSocioCount(id);
  return {
    ...updated,
    assignedSocioCount,
  };
}

/**
 * Server-side handler for DELETE /api/membresias/[id]
 * Deletes a membresia only if no socios are assigned
 */
export async function handleMembresiaDelete(id: string): Promise<void> {
  const repository = new MembresiaRepository();
  const membresia = await repository.getById(id);

  if (!membresia) {
    const error = new Error("NOT_FOUND: Membresía no encontrada");
    (error as CodedError).code = "NOT_FOUND";
    throw error;
  }

  // Check if assigned to any socios (AC-006)
  const assignedCount = await repository.getAssignedSocioCount(id);
  if (assignedCount > 0) {
    const error = new Error(`DELETE_BLOCKED_ASSIGNED: No se puede eliminar: ${assignedCount} socios asignados`);
    (error as CodedError).code = "DELETE_BLOCKED_ASSIGNED";
    (error as CodedError).assignedCount = assignedCount;
    throw error;
  }

  // Delete from database
  await repository.delete(id);
}

/**
 * Client-side function to fetch all membresias for dropdowns
 * Returns ACTIVA only with minimal fields for performance
 * Used in T-013 Cliente CRUD
 */
export interface MembresiaDropdown {
  id: string;
  nombre: string;
  precio: number;
  estado: EstadoMembresia;
}

export async function fetchMembresias(): Promise<MembresiaDropdown[]> {
  const response = await fetch("/api/membresias/activas");
  if (!response.ok) {
    throw new Error(`Failed to fetch membresias: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

/**
 * Client-side API call: fetch every membresía (management list, T-017).
 * Distinct from `fetchMembresias` (active-only dropdown for Clientes, AC-004).
 * The list includes `assignedSocioCount` for the "Miembros" column (AC-007).
 */
export async function fetchMembresiasList(): Promise<Membresia[]> {
  const response = await fetch("/api/membresias");
  await throwIfNotOk(response, "No se pudieron cargar las membresías");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Client-side API call: delete a membresía.
 * The server guards assigned socios with DELETE_BLOCKED_ASSIGNED (AC-006).
 */
export async function deleteMembresia(id: string): Promise<void> {
  const response = await fetch(`/api/membresias/${id}`, { method: "DELETE" });
  await throwIfNotOk(response, "No se pudo eliminar la membresía");
}
