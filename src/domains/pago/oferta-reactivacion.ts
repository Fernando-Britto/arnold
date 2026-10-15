/**
 * Oferta de reactivación: elegibilidad y descuento (T-045a, D-54). Funciones puras: sin Prisma ni React.
 * Spec: openspec/specs/oferta-reactivacion/spec.md
 *
 * La elegibilidad se calcula al consultar (no hay proceso programado ni columna que la guarde). Quien
 * consulta la base arma la entrada: `ultimaAsistenciaPermitida` es la `fechaHora` de la última `Asistencia`
 * con `estado = PERMITIDO` (el ingreso autorizado por excepción cuenta, el DENEGADO no) y
 * `ultimoPagoConDescuento` es la `fechaPago` del último `Pago` CONFIRMADO con descuento aplicado.
 * El descuento se aplica en el servidor al registrar el pago (T-045c); la pantalla solo muestra una vista previa.
 */
import type { EstadoCuenta } from "@/domains/acceso/check-in";
import type { Configuracion } from "@/lib/configuracion";
import type { EstadoCuotaSocio } from "./cuota";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Rango del porcentaje: 1–50 %. Con 100 % habría pagos de $0, de ahí el tope (D-54). */
const DESCUENTO_MIN = 1;
const DESCUENTO_MAX = 50;

export type ConfigOferta = Pick<
  Configuracion,
  "ofertaReactivacionActiva" | "diasSinAsistirParaOferta" | "descuentoReactivacion" | "enfriamientoOfertaDias"
>;

export interface EvaluarOfertaInput {
  config: ConfigOferta;
  /** Estado de la CUENTA (`Socio.estadoCuota`, D-46). */
  estadoCuenta: EstadoCuenta;
  tieneMembresia: boolean;
  /** Estado de PAGO calculado con `estadoCuotaSocio` (D-40). */
  estadoPago: EstadoCuotaSocio;
  /** Última asistencia con `estado = PERMITIDO`, o null si nunca asistió. */
  ultimaAsistenciaPermitida: Date | null;
  fechaAlta: Date;
  /** `fechaPago` del último `Pago` CONFIRMADO con descuento aplicado, o null si nunca usó una oferta. */
  ultimoPagoConDescuento: Date | null;
  hoy: Date;
}

/** Por qué no es elegible, en el orden de las condiciones de la spec (informa la primera que falla). */
export type MotivoNoElegible =
  | "OFERTA_APAGADA"
  | "CONFIGURACION_INVALIDA"
  | "CUENTA_NO_HABILITADA"
  | "SIN_MEMBRESIA"
  | "CUOTA_NO_VENCIDA"
  | "ACTIVIDAD_RECIENTE"
  | "EN_ENFRIAMIENTO";

export type EvaluacionOferta =
  | { elegible: true; descuentoPct: number }
  | { elegible: false; motivo: MotivoNoElegible };

export function descuentoEsValido(pct: number): boolean {
  return Number.isFinite(pct) && pct >= DESCUENTO_MIN && pct <= DESCUENTO_MAX;
}

const esCantidadDeDias = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Evalúa las cinco condiciones de elegibilidad. Con una configuración inválida (porcentaje fuera de
 * rango, días que no son un número) NO se ofrece: ante la duda se cobra de lista, nunca de más ni de menos.
 */
export function evaluarOferta(input: EvaluarOfertaInput): EvaluacionOferta {
  const { config, hoy } = input;

  // 1. Interruptor y configuración
  if (!config.ofertaReactivacionActiva) return { elegible: false, motivo: "OFERTA_APAGADA" };
  if (
    !descuentoEsValido(config.descuentoReactivacion) ||
    !esCantidadDeDias(config.diasSinAsistirParaOferta) ||
    !esCantidadDeDias(config.enfriamientoOfertaDias)
  ) {
    return { elegible: false, motivo: "CONFIGURACION_INVALIDA" };
  }

  // 2. Cuenta habilitada y con membresía
  if (input.estadoCuenta !== "AL_DIA") return { elegible: false, motivo: "CUENTA_NO_HABILITADA" };
  if (!input.tieneMembresia) return { elegible: false, motivo: "SIN_MEMBRESIA" };

  // 3. Solo cuota vencida: PENDIENTE, AL_DIA y SIN_CUOTA no
  if (input.estadoPago !== "VENCIDA") return { elegible: false, motivo: "CUOTA_NO_VENCIDA" };

  // 4. Sin actividad desde hace `diasSinAsistirParaOferta` (inclusive). Si nunca asistió, se mide desde el alta.
  const referencia = input.ultimaAsistenciaPermitida ?? input.fechaAlta;
  if (referencia.getTime() > hoy.getTime() - config.diasSinAsistirParaOferta * DIA_MS) {
    return { elegible: false, motivo: "ACTIVIDAD_RECIENTE" };
  }

  // 5. Enfriamiento: bloquea un pago con descuento POSTERIOR a hoy − enfriamiento (con 0 días no bloquea nunca)
  if (
    input.ultimoPagoConDescuento &&
    input.ultimoPagoConDescuento.getTime() > hoy.getTime() - config.enfriamientoOfertaDias * DIA_MS
  ) {
    return { elegible: false, motivo: "EN_ENFRIAMIENTO" };
  }

  return { elegible: true, descuentoPct: config.descuentoReactivacion };
}
