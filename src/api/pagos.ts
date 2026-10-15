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
import {
  anularPago as anularPagoDominio,
  type AnularPagoInput,
  type PagoAnulado,
} from "@/domains/pago/anular-pago";
import { throwIfNotOk } from "@/utils/api-error";

export type { RegistrarPagoInput, PagoRegistrado } from "@/domains/pago/registrar-pago";
export type { AnularPagoInput, PagoAnulado } from "@/domains/pago/anular-pago";

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
 * Handle POST /api/pagos/{id}/anular — anula un pago (P-39): lo pasa a ANULADO y borra la
 * cuota que creó (salvo que tenga otro pago vigente).
 */
export async function handleAnularPago(input: AnularPagoInput): Promise<PagoAnulado> {
  return anularPagoDominio(input);
}

/** Pago del historial tal como lo serializa GET /api/pagos (Decimal y fechas como string). */
export interface PagoHistorial {
  id: string;
  fechaPago: string;
  monto: string | number;
  metodoPago: string;
  estado: "CONFIRMADO" | "PENDIENTE" | "ANULADO";
  cuotaId: string | null;
}


/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/**
 * Client-side API call: registrar un pago. La sesión viaja en la cookie (HttpOnly);
 * el cliente no adjunta headers de auth (PG-7).
 */
export async function createPago(input: RegistrarPagoInput): Promise<PagoRegistrado> {
  const response = await fetch("/api/pagos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar el pago");
  return response.json();
}

/**
 * Client-side API call: historial de pagos de un socio (GET /api/pagos?socioId=).
 */
export async function fetchPagosDeSocio(socioId: string): Promise<PagoHistorial[]> {
  const response = await fetch(`/api/pagos?socioId=${encodeURIComponent(socioId)}`);
  await throwIfNotOk(response, "No se pudo cargar el historial de pagos");
  return response.json();
}

/**
 * Client-side API call: anular un pago con un motivo obligatorio (POST /api/pagos/{id}/anular).
 */
export async function anularPago(pagoId: string, motivo: string): Promise<PagoAnulado> {
  const response = await fetch(`/api/pagos/${encodeURIComponent(pagoId)}/anular`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
  await throwIfNotOk(response, "No se pudo anular el pago");
  return response.json();
}
