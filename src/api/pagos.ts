/**
 * Capa API de pagos (T-032): handlers server-side y helpers de fetch del cliente.
 * La lógica vive en el dominio (`src/domains/pago/registrar-pago.ts`).
 */
import {
  registrarPago,
  listarPagosDeSocio,
  type PagoRegistrado,
  type RegistrarPagoInput,
} from "@/domains/pago/registrar-pago";
import { throwIfNotOk } from "@/utils/api-error";

export type { RegistrarPagoInput, PagoRegistrado } from "@/domains/pago/registrar-pago";

/**
 * Handle POST /api/pagos — registra un pago y devuelve el pago, la cuota, el plan y el
 * estado de pago resultante.
 */
export async function handleRegistrarPago(input: RegistrarPagoInput): Promise<PagoRegistrado> {
  return registrarPago(input);
}

/**
 * Handle GET /api/pagos?socioId= — historial de pagos de un socio.
 */
export async function handleListarPagos(socioId: string) {
  return listarPagosDeSocio(socioId);
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/** Authorization header con el JWT de localStorage (mismo patrón que clientes). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Client-side API call: registrar un pago.
 */
export async function createPago(input: RegistrarPagoInput): Promise<PagoRegistrado> {
  const response = await fetch("/api/pagos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar el pago");
  return response.json();
}

/**
 * Client-side API call: historial de pagos de un socio.
 */
export async function fetchPagosDeSocio(socioId: string) {
  const response = await fetch(`/api/pagos?socioId=${encodeURIComponent(socioId)}`, {
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudieron cargar los pagos");
  return response.json();
}
