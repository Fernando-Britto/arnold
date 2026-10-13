/**
 * Capa API de cierres de caja (T-040): handlers server-side y helpers de fetch del
 * cliente. La lógica vive en el dominio (`src/domains/cierre/cierre-de-caja.ts`).
 *
 * El rango por defecto es el día del gimnasio: desde las 00:00 locales (UTC-3) hasta
 * el instante actual. Reutiliza `startOfGymDay` (src/lib/gym-time.ts).
 */
import {
  cerrarCaja,
  listarCierres,
  previsualizarCierre,
  resolverEmpleadoId,
  type CierreDeCajaCreado,
  type TotalesDeCaja,
} from "@/domains/cierre/cierre-de-caja";
import { startOfGymDay } from "@/lib/gym-time";
import { throwIfNotOk } from "@/utils/api-error";

export type { CierreDeCajaCreado, TotalesDeCaja } from "@/domains/cierre/cierre-de-caja";

export interface CerrarCajaRequest {
  /** `Usuario.id` de la persona logueada (se resuelve a su `Empleado`). */
  usuarioId: string;
  desde?: Date;
  hasta?: Date;
  /** Inyectable en tests para fijar el rango por defecto. */
  ahora?: Date;
}

export interface PrevisualizarCierreRequest {
  desde?: Date;
  hasta?: Date;
  ahora?: Date;
}

/** Rango del turno: el enviado, o el día del gimnasio hasta ahora. */
function rangoPorDefecto(input: { desde?: Date; hasta?: Date; ahora?: Date }) {
  const ahora = input.ahora ?? new Date();
  return {
    desde: input.desde ?? startOfGymDay(ahora),
    hasta: input.hasta ?? ahora,
  };
}

/**
 * Handle POST /api/cierres — resuelve el Empleado del usuario y cierra la caja.
 *
 * @throws Error("VALIDATION_ERROR: ...") si el usuario no tiene un empleado asociado.
 */
export async function handleCerrarCaja(input: CerrarCajaRequest): Promise<CierreDeCajaCreado> {
  const responsableId = await resolverEmpleadoId(input.usuarioId);
  return cerrarCaja({ responsableId, ...rangoPorDefecto(input) });
}

/** Handle GET /api/cierres — cierres recientes. */
export async function handleListarCierres() {
  return listarCierres();
}

/** Handle GET /api/cierres?preview=1 — totales pendientes de cierre (sin persistir). */
export async function handlePrevisualizarCierre(
  input: PrevisualizarCierreRequest = {}
): Promise<TotalesDeCaja> {
  return previsualizarCierre(rangoPorDefecto(input));
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/** Authorization header con el JWT de localStorage (mismo patrón que pagos/socios). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Client-side API call: totales pendientes de cierre del turno. */
export async function fetchPreviewCierre(): Promise<TotalesDeCaja> {
  const response = await fetch("/api/cierres?preview=1", {
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudo calcular el cierre de caja");
  return response.json();
}

/** Client-side API call: confirmar el cierre de caja. */
export async function createCierre(): Promise<CierreDeCajaCreado> {
  const response = await fetch("/api/cierres", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });
  await throwIfNotOk(response, "No se pudo cerrar la caja");
  return response.json();
}

/** Client-side API call: cierres recientes. */
export async function fetchCierres() {
  const response = await fetch("/api/cierres", {
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudieron cargar los cierres");
  return response.json();
}
