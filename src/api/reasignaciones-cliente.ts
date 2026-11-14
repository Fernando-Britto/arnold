/**
 * Cliente de la reasignación (P-61), solo navegador. Los tipos se importan como **tipo** desde el
 * handler del servidor para no arrastrar backend al bundle (mismo criterio que `asignaciones-cliente`).
 */
import type { RespuestaReasignacionDTO, SesionEnCursoStaffDTO } from "@/api/reasignaciones";
import { throwIfNotOk } from "@/utils/api-error";

/** GET /api/reasignaciones — sesiones abiertas para el panel del staff. */
export async function fetchSesionesEnCurso(signal?: AbortSignal): Promise<SesionEnCursoStaffDTO[]> {
  const response = await fetch("/api/reasignaciones", { signal });
  await throwIfNotOk(response, "No se pudieron cargar las sesiones en curso");
  return response.json();
}

/** POST /api/reasignaciones — cambia la máquina de una ejecución EN_CURSO. */
export async function reasignarMaquinaApi(
  asignacionId: string,
  maquinaId: string,
  signal?: AbortSignal
): Promise<RespuestaReasignacionDTO> {
  const response = await fetch("/api/reasignaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asignacionId, maquinaId }),
    signal,
  });
  await throwIfNotOk(response, "No se pudo reasignar la máquina");
  return response.json();
}
