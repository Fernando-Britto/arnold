/**
 * Fetches de navegador para el panel de huella de /clientes (T-041).
 *
 * Módulo aparte de `@/api/huellas`: aquel importa `@/api/acceso` de forma estática, que a su vez
 * arrastra `@/lib/auth` (bcrypt/jsonwebtoken) al bundle del cliente. Acá sólo viven los fetches.
 * La sesión viaja en la cookie (HttpOnly); el cliente no adjunta headers de auth (PG-7).
 */
import { throwIfNotOk } from "@/utils/api-error";

export interface SolicitudHuella {
  id: string;
  accion: "ENROLAR" | "BORRAR";
  huellaId: number;
  estado: "PENDIENTE" | "CONFIRMADA" | "FALLIDA";
  motivo: string | null;
  duplicadoDe: number | null;
  createdAt: string;
  resueltaEn: string | null;
}

/** Estado de la huella devuelto por `GET /api/socios/{id}/huella` (fechas en ISO). */
export interface EstadoHuella {
  huellaId: number | null;
  consentimientoEn: string | null;
  solicitud: SolicitudHuella | null;
}

/** Client-side: estado de la huella del socio y su solicitud más reciente. */
export async function fetchEstadoHuella(socioId: string): Promise<EstadoHuella> {
  const response = await fetch(`/api/socios/${socioId}/huella`);
  await throwIfNotOk(response, "No se pudo consultar el estado de la huella");
  return response.json();
}

/** Client-side: encola un enrolamiento (exige consentimiento informado). */
export async function registrarHuella(socioId: string): Promise<void> {
  const response = await fetch(`/api/socios/${socioId}/huella`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "enrolar", consentimiento: true }),
  });
  await throwIfNotOk(response, "No se pudo registrar la huella");
}

/** Client-side: encola la baja de la huella del socio. */
export async function eliminarHuella(socioId: string): Promise<void> {
  const response = await fetch(`/api/socios/${socioId}/huella`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "borrar" }),
  });
  await throwIfNotOk(response, "No se pudo eliminar la huella");
}
