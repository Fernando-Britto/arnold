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

export interface DescuentoCalculado {
  montoLista: number;
  descuentoPct: number;
  montoFinal: number;
}

/**
 * Descuento sobre el cobro completo (si el plan cubre dos períodos, sobre el total). Se calcula en
 * centavos enteros y se redondea al centavo, igual que el prorrateo de `cuota.ts`.
 */
export function calcularDescuento(input: { monto: number; descuentoPct: number }): DescuentoCalculado {
  const { monto, descuentoPct } = input;
  if (!Number.isFinite(monto) || monto < 0) throw new RangeError("El monto debe ser un número mayor o igual a 0");
  if (!descuentoEsValido(descuentoPct)) {
    throw new RangeError(`El descuento debe estar entre ${DESCUENTO_MIN} y ${DESCUENTO_MAX} %`);
  }

  const centavos = Math.round(monto * 100);
  // Centésimas de punto porcentual (12,5 % → 1250): evita multiplicar por un decimal en coma flotante
  const centesimas = Math.round(descuentoPct * 100);
  const finalCentavos = Math.round((centavos * (10000 - centesimas)) / 10000);

  return { montoLista: centavos / 100, descuentoPct, montoFinal: finalCentavos / 100 };
}

export interface MontoConOferta {
  /** Lo que se cobra (`Pago.monto`). */
  monto: number;
  /** Precio de lista antes del descuento; null si no hubo oferta. */
  montoLista: number | null;
  /** Porcentaje aplicado; null si no hubo oferta. */
  descuentoPct: number | null;
}

/**
 * Lo que `registrarPago` guarda en el `Pago`. Sin oferta devuelve el monto tal cual (cobro idéntico
 * al de hoy) con `montoLista` y `descuentoPct` nulos.
 */
export function aplicarOferta(input: { monto: number; evaluacion: EvaluacionOferta }): MontoConOferta {
  const { monto, evaluacion } = input;
  if (!evaluacion.elegible) return { monto, montoLista: null, descuentoPct: null };

  const d = calcularDescuento({ monto, descuentoPct: evaluacion.descuentoPct });
  return { monto: d.montoFinal, montoLista: d.montoLista, descuentoPct: d.descuentoPct };
}
