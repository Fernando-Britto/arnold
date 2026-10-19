/**
 * Peso corporal del socio (T-048, D-65): handlers del servidor y llamadas del navegador.
 * Las reglas viven en `@/domains/peso`; acá solo se conectan con las rutas y la pantalla.
 */
import { eliminarPeso, fijarMetaDePeso, registrarPeso } from "@/domains/peso/peso-socio";
import { throwIfNotOk } from "@/utils/api-error";

/** Handle POST /api/peso — registra un pesaje. El dominio valida el tipo y el rango. */
export async function handleRegistrarPeso(input: { socioId: string; peso: unknown }) {
  return registrarPeso({ socioId: input.socioId, peso: input.peso as number });
}

/**
 * Handle DELETE /api/peso/[id] — borra un pesaje propio (P-47). El socio sale del token.
 * @throws Error("NOT_FOUND") si el pesaje no existe o no es del socio.
 */
export async function handleEliminarPeso(input: { socioId: string; id: string }) {
  await eliminarPeso(input);
}

/** Handle PUT /api/peso/meta — fija la meta de peso, o la borra si es `null`. */
export async function handleFijarMeta(input: { socioId: string; pesoObjetivo: unknown }) {
  return fijarMetaDePeso({
    socioId: input.socioId,
    pesoObjetivo: input.pesoObjetivo as number | null,
  });
}

/** Un pesaje tal como llega del servidor. */
export interface PesajeDTO {
  id: string;
  /** kg. */
  peso: number;
  fecha: string;
}

/** La meta de peso tal como llega del servidor; ambos campos son null si no hay meta. */
export interface MetaDePesoDTO {
  pesoObjetivo: number | null;
  /** Peso desde el que se fijó la meta: dice si el objetivo era bajar o subir. */
  pesoInicial: number | null;
}

/** POST /api/peso — registra el peso del socio (kg). */
export async function registrarPesoCorporal(peso: number): Promise<PesajeDTO> {
  const response = await fetch("/api/peso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peso }),
  });
  await throwIfNotOk(response, "No se pudo registrar el peso");
  return response.json();
}

/** PUT /api/peso/meta — fija la meta de peso (kg), o la borra con `null`. */
export async function fijarMetaDePesoCorporal(pesoObjetivo: number | null): Promise<MetaDePesoDTO> {
  const response = await fetch("/api/peso/meta", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pesoObjetivo }),
  });
  await throwIfNotOk(response, "No se pudo guardar la meta");
  return response.json();
}

/** DELETE /api/peso/[id] — borra un pesaje propio. */
export async function eliminarPesoCorporal(id: string): Promise<void> {
  const response = await fetch(`/api/peso/${encodeURIComponent(id)}`, { method: "DELETE" });
  await throwIfNotOk(response, "No se pudo borrar el pesaje");
}
