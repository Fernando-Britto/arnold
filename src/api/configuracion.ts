/**
 * Capa API de configuración (T-043c): helpers de fetch del cliente.
 * Los tipos y los rangos viven en `@/lib/configuracion` (T-043a) y
 * `@/domains/configuracion/configuracion` (T-043b); acá solo se arma la petición.
 */
import { throwIfNotOk } from "@/utils/api-error";
import type { Configuracion } from "@/lib/configuracion";
import type { CambiosConfiguracion } from "@/domains/configuracion/configuracion";

/**
 * Client-side API call: parámetros actuales del sistema.
 * La sesión viaja en la cookie (HttpOnly); el cliente no adjunta headers de auth.
 */
export async function fetchConfiguracion(): Promise<Configuracion> {
  const response = await fetch("/api/configuracion");
  await throwIfNotOk(response, "No se pudo cargar la configuración");
  return response.json();
}

/**
 * Client-side API call: aplica los cambios enviados y devuelve la configuración resultante.
 */
export async function guardarConfiguracion(cambios: CambiosConfiguracion): Promise<Configuracion> {
  const response = await fetch("/api/configuracion", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cambios),
  });
  await throwIfNotOk(response, "No se pudo guardar la configuración");
  return response.json();
}
