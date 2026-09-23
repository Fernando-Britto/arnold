import { validateMembresia, type Membresia as MembresiaDomain, type EstadoMembresia } from "@/domains/membresia/membresia";
import { MembresiaRepository } from "@/domains/membresia/membresia";

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
  descripcion?: string;
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
    (error as any).code = "VALIDATION_ERROR";
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
export async function handleMembresiaList(): Promise<Membresia[]> {
  const repository = new MembresiaRepository();
  const membresias = await repository.getAll();

  // Fetch assigned counts for each
  const withCounts = await Promise.all(
    membresias.map(async (m) => ({
      ...m,
      assignedSocioCount: await repository.getAssignedSocioCount(m.id),
    }))
  );

  return withCounts;
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
    (error as any).code = "NOT_FOUND";
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
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  // Merge with existing data
  const merged = {
    nombre: input.nombre ?? existing.nombre,
    precio: input.precio ?? existing.precio,
    periodicidad: input.periodicidad ?? existing.periodicidad,
    descripcion: (input.descripcion !== undefined ? input.descripcion : existing.descripcion) || undefined,
    estado: input.estado ?? existing.estado,
  };

  // Validate merged data
  const validation = validateMembresia(merged);
  if (!validation.valid) {
    const error = new Error(`VALIDATION_ERROR: ${validation.errors[0] || "Validation failed"}`);
    (error as any).code = "VALIDATION_ERROR";
    throw error;
  }

  // Check deactivation warning (AC-005): requires explicit confirmation if socios assigned
  if (input.estado === "INACTIVA" && existing.estado === "ACTIVA") {
    const assignedCount = await repository.getAssignedSocioCount(id);
    if (assignedCount > 0 && input.confirmarDesactivacion !== true) {
      // Warn but don't block — require explicit confirmation
      const error = new Error(`DEACTIVATION_WARNING: ${assignedCount} socios tienen esta membresía asignada`);
      (error as any).code = "DEACTIVATION_WARNING";
      (error as any).assignedCount = assignedCount;
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
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  // Check if assigned to any socios (AC-006)
  const assignedCount = await repository.getAssignedSocioCount(id);
  if (assignedCount > 0) {
    const error = new Error(`DELETE_BLOCKED_ASSIGNED: No se puede eliminar: ${assignedCount} socios asignados`);
    (error as any).code = "DELETE_BLOCKED_ASSIGNED";
    (error as any).assignedCount = assignedCount;
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
  const response = await fetch("/api/membresias?activeOnly=true");
  if (!response.ok) {
    throw new Error(`Failed to fetch membresias: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}
