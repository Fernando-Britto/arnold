/**
 * Client-side API functions for Membresía endpoints
 * Temporary implementation for T-013 (full implementation in T-016)
 */

export interface Membresia {
  id: string;
  nombre: string;
  precio: number;
  estado: "ACTIVA" | "INACTIVA";
}

/**
 * Fetch all membresias (returns ACTIVA only)
 * TODO: Move to /api/membresias route in T-016
 */
export async function fetchMembresias(): Promise<Membresia[]> {
  const response = await fetch("/api/membresias");
  if (!response.ok) {
    throw new Error(`Failed to fetch membresias: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}
