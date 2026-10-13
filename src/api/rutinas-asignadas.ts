/**
 * Capa API de rutinas asignadas (T-034): handlers server-side y helpers de fetch del cliente.
 * La lógica de negocio (RN-04) vive en el dominio (`src/domains/rutina/asignar-rutina.ts`).
 */
import {
  asignarRutina,
  listarRutinasDeSocio,
  type AsignarRutinaInput,
} from "@/domains/rutina/asignar-rutina";
import { throwIfNotOk } from "@/utils/api-error";

export type { AsignarRutinaInput } from "@/domains/rutina/asignar-rutina";

/**
 * Handle POST /api/rutinas-asignadas — asigna una rutina a un socio (RN-04).
 */
export async function handleAsignarRutina(input: AsignarRutinaInput) {
  return asignarRutina(input);
}

/**
 * Handle GET /api/rutinas-asignadas?socioId= — asignaciones de un socio, más nuevas primero.
 */
export async function handleListarRutinasDeSocio(socioId: string) {
  return listarRutinasDeSocio(socioId);
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for the modal)
 * ============================================
 */

/** Authorization header con el JWT de localStorage (mismo patrón que pagos/socios). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Client-side API call: asignar una rutina a un socio.
 */
export async function createAsignacionRutina(input: AsignarRutinaInput) {
  const response = await fetch("/api/rutinas-asignadas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo asignar la rutina");
  return response.json();
}

/**
 * Client-side API call: asignaciones de un socio.
 */
export async function fetchRutinasDeSocio(socioId: string) {
  const response = await fetch(`/api/rutinas-asignadas?socioId=${encodeURIComponent(socioId)}`, {
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudieron cargar las rutinas del socio");
  return response.json();
}
