/**
 * Capa API de cierres de caja (T-040): handlers server-side y helpers de fetch del
 * cliente. La lógica vive en el dominio (`src/domains/cierre/cierre-de-caja.ts`).
 *
 * El rango por defecto es el día del gimnasio: desde las 00:00 locales (UTC-3) hasta
 * el instante actual. Reutiliza `startOfGymDay` (src/lib/gym-time.ts).
 */
import {
  cerrarCaja,
  contarCierres,
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

/**
 * Totales de la previsualización + el rango efectivamente usado (ISO). El cliente
 * debe cerrar con ESE rango: si la pantalla quedó abierta cruzando la medianoche,
 * `new Date()` en el POST daría un día distinto al previsualizado (CC-2).
 */
export interface PreviewCierreResult extends TotalesDeCaja {
  desde: string;
  hasta: string;
}

/** Rango que el POST de cierre acepta en el cuerpo (ISO). */
export interface RangoCierreDTO {
  desde: string;
  hasta: string;
}

/**
 * Fila de `Pago` tal como viene incluida en el listado de cierres. Prisma serializa
 * `monto` (`Decimal`) a string; la UI lo normaliza con `formatMoney`.
 */
export interface PagoDeCierreDTO {
  id: string;
  fechaPago: string;
  monto: number | string;
  metodoPago: string;
  estado: string;
}

/**
 * Fila de `CierreDeCaja` tal como llega del GET (listado). Prisma serializa los `Decimal`
 * a string, por eso los totales se aceptan como `number | string` y la UI los normaliza.
 */
export interface CierreDeCajaResumenDTO {
  id: string;
  createdAt: string;
  totalRecaudado: number | string;
  totalEfectivo: number | string;
  totalTransferencia: number | string;
  totalTarjeta: number | string;
  cantidadOperaciones: number;
  pagos: PagoDeCierreDTO[];
}

/** Página del listado de cierres: filas + total para paginar. */
export interface PaginaDeCierres {
  items: CierreDeCajaResumenDTO[];
  total: number;
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

/** Handle GET /api/cierres — página de cierres recientes + total. */
export async function handleListarCierres(opciones?: {
  limit?: number;
  offset?: number;
}): Promise<PaginaDeCierres> {
  const [items, total] = await Promise.all([
    listarCierres(opciones),
    contarCierres(),
  ]);
  return {
    // Prisma devuelve `Decimal` y `Date`; el DTO los declara como string/number.
    items: items as unknown as CierreDeCajaResumenDTO[],
    total,
  };
}

/** Handle GET /api/cierres?preview=1 — totales pendientes de cierre (sin persistir) + rango usado. */
export async function handlePrevisualizarCierre(
  input: PrevisualizarCierreRequest = {}
): Promise<PreviewCierreResult> {
  const rango = rangoPorDefecto(input);
  const totales = await previsualizarCierre(rango);
  return {
    ...totales,
    desde: rango.desde.toISOString(),
    hasta: rango.hasta.toISOString(),
  };
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/**
 * Client-side fetches: la sesión viaja en la cookie (HttpOnly); el cliente no adjunta
 * headers de auth (PG-7).
 */

/** Client-side API call: totales pendientes de cierre del turno + rango usado. */
export async function fetchPreviewCierre(): Promise<PreviewCierreResult> {
  const response = await fetch("/api/cierres?preview=1");
  await throwIfNotOk(response, "No se pudo calcular el cierre de caja");
  return response.json();
}

/**
 * Client-side API call: confirmar el cierre de caja. Si se pasa `rango`, se envía
 * en el cuerpo para cerrar exactamente lo previsualizado (CC-2); sin rango, el
 * server usa el día del gimnasio hasta ahora.
 */
export async function createCierre(rango?: RangoCierreDTO): Promise<CierreDeCajaCreado> {
  const response = await fetch("/api/cierres", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: rango ? JSON.stringify(rango) : undefined,
  });
  await throwIfNotOk(response, "No se pudo cerrar la caja");
  return response.json();
}

/**
 * Client-side API call: página de cierres recientes. Sin parámetros llama exactamente a
 * `/api/cierres` (el server aplica sus defaults); con parámetros arma la query.
 */
export async function fetchCierres(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginaDeCierres> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  const response = await fetch(qs ? `/api/cierres?${qs}` : "/api/cierres");
  await throwIfNotOk(response, "No se pudieron cargar los cierres");
  return response.json();
}
