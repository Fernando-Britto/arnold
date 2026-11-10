/**
 * Cliente de la sugerencia de asignación (T-057b). Solo navegador.
 *
 * Los DTO se importan como **tipo** desde el handler del servidor: se borran en compilación, así que
 * no arrastran backend al bundle y, si el contrato cambia, esto deja de compilar (design §2).
 */
import type { RespuestaSugerencia } from "@/api/asignaciones";
import { throwIfNotOk } from "@/utils/api-error";

/** GET /api/asignaciones/sugerencia — lectura pura, no crea ni modifica reservas. */
export async function fetchSugerencia(signal?: AbortSignal): Promise<RespuestaSugerencia> {
  const response = await fetch("/api/asignaciones/sugerencia", { signal });
  await throwIfNotOk(response, "No se pudo calcular tu próxima máquina");
  return response.json();
}
