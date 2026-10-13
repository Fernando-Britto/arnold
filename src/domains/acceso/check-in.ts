/**
 * Decisión de acceso al gimnasio — reglas puras (T-035, D-47). Sin Prisma ni React.
 *
 * Dos pasos (D-46): primero la CUENTA (`Socio.estadoCuota`: AL_DIA / INACTIVA / BLOQUEADA)
 * y después el PAGO calculado por `estadoCuotaSocio` (D-40). El anti-passback niega un
 * segundo ingreso del mismo socio dentro de la ventana configurable.
 *
 * El llamador (servicio) calcula el aviso de PENDIENTE ("Cuota a pagar hasta el día N") y
 * lo pasa como texto: acá no se conoce el calendario ni la configuración.
 */
import type { EstadoCuotaSocio } from "@/domains/pago/cuota";

/** Estado de la cuenta (`Socio.estadoCuota`, D-46). No describe un pago. */
export type EstadoCuenta = "AL_DIA" | "INACTIVA" | "BLOQUEADA";

export type ResultadoAcceso = "PERMITIDO" | "PERMITIDO_CON_AVISO" | "DENEGADO";

export interface DecidirAccesoInput {
  /** Estado de pago calculado con `estadoCuotaSocio` (D-40). */
  estadoCuota: EstadoCuotaSocio;
  /** Estado de la cuenta (`Socio.estadoCuota`, D-46). */
  estadoCuenta: EstadoCuenta;
  /** true si ya hay un ingreso PERMITIDO del socio dentro de la ventana. */
  antiPassback: boolean;
  /** Aviso a mostrar cuando el pago está PENDIENTE (p. ej. "Cuota a pagar hasta el día 10"). */
  mensajePendiente?: string;
}

export interface DecisionAcceso {
  resultado: ResultadoAcceso;
  motivo?: string;
}

export const MOTIVO_CUENTA_INACTIVA = "Cuenta inactiva";
export const MOTIVO_CUENTA_BLOQUEADA = "Cuenta bloqueada";
export const MOTIVO_ANTI_PASSBACK = "Ya registró su ingreso";
export const MOTIVO_CUOTA_VENCIDA = "Cuota vencida; requiere autorización";
export const MOTIVO_SIN_CUOTA = "No registra cuota; requiere autorización";
export const MOTIVO_PENDIENTE_DEFAULT = "Cuota pendiente de pago";

/**
 * Decide el resultado del check-in. Orden (D-46 + D-47):
 *   1. Cuenta INACTIVA/BLOQUEADA → DENEGADO.
 *   2. Anti-passback → DENEGADO.
 *   3. Pago: AL_DIA → PERMITIDO; PENDIENTE → PERMITIDO_CON_AVISO; VENCIDA/SIN_CUOTA → DENEGADO.
 */
export function decidirAcceso(input: DecidirAccesoInput): DecisionAcceso {
  const { estadoCuota, estadoCuenta, antiPassback, mensajePendiente } = input;

  if (estadoCuenta === "INACTIVA") {
    return { resultado: "DENEGADO", motivo: MOTIVO_CUENTA_INACTIVA };
  }
  if (estadoCuenta === "BLOQUEADA") {
    return { resultado: "DENEGADO", motivo: MOTIVO_CUENTA_BLOQUEADA };
  }
  if (antiPassback) {
    return { resultado: "DENEGADO", motivo: MOTIVO_ANTI_PASSBACK };
  }

  switch (estadoCuota) {
    case "AL_DIA":
      return { resultado: "PERMITIDO" };
    case "PENDIENTE":
      return { resultado: "PERMITIDO_CON_AVISO", motivo: mensajePendiente ?? MOTIVO_PENDIENTE_DEFAULT };
    case "VENCIDA":
      return { resultado: "DENEGADO", motivo: MOTIVO_CUOTA_VENCIDA };
    case "SIN_CUOTA":
      return { resultado: "DENEGADO", motivo: MOTIVO_SIN_CUOTA };
  }
}
