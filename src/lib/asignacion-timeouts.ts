/**
 * Timeouts del cálculo de asignación, configurables por entorno (D-110).
 *
 * El dominio NO lee `process.env`: esta capa resuelve y valida los valores, y quien llama a la
 * orquestación los pasa por parámetro. Cualquier valor ausente, no entero o fuera de rango cae al
 * valor por defecto sin lanzar: un error de configuración nunca debe romper el check-in.
 */

export interface TimeoutsAsignacion {
  /** `timeout` de la transacción interactiva y base de la carrera externa. */
  calculoMs: number;
  /** `maxWait` de la transacción (tiempo para conseguir conexión). */
  maxWaitMs: number;
}

export const TIMEOUT_CALCULO_POR_DEFECTO = 2000;
export const MAX_WAIT_POR_DEFECTO = 1000;
export const TIMEOUT_MIN_MS = 500;
export const TIMEOUT_MAX_MS = 30_000;

function enteroEnRango(valor: string | undefined, porDefecto: number): number {
  if (valor === undefined) return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return porDefecto;
  if (numero < TIMEOUT_MIN_MS || numero > TIMEOUT_MAX_MS) return porDefecto;
  return numero;
}

export function timeoutsDeEntorno(
  env: Record<string, string | undefined> = process.env
): TimeoutsAsignacion {
  return {
    calculoMs: enteroEnRango(env.ASIGNACION_TIMEOUT_CALCULO_MS, TIMEOUT_CALCULO_POR_DEFECTO),
    maxWaitMs: enteroEnRango(env.ASIGNACION_MAX_WAIT_TRANSACCION_MS, MAX_WAIT_POR_DEFECTO),
  };
}
