/**
 * Cuotas mensuales — reglas de cálculo (T-031, D-40). Funciones puras: sin Prisma ni React.
 * Spec: openspec/specs/pagos-cuotas/spec.md
 *
 * Modelo: una cuota cubre un tramo de fechas (`Cuota.fechaInicio` → `Cuota.fechaVencimiento`),
 * siempre hasta el último instante de un mes calendario. El "período" (YYYY-MM) se deduce de
 * esas fechas, en hora argentina. El mes se paga del 1 al `diaLimite`; pasado ese día sin
 * pago la cuota está vencida.
 */
import { toGymWallClock } from "@/lib/gym-time";

/** Mes calendario en formato "YYYY-MM". */
export type Periodo = string;

export type TipoPlanDePago = "ALTA_PRORRATEO" | "ALTA_COMPLETA" | "RENOVACION";

export interface PlanDePago {
  tipo: TipoPlanDePago;
  /** Períodos que cubre el pago, en orden. */
  periodos: Periodo[];
  /** Monto a cobrar, redondeado al centavo. */
  monto: number;
  cubreDesde: Date;
  cubreHasta: Date;
}

export type EstadoCuotaSocio = "AL_DIA" | "PENDIENTE" | "VENCIDA" | "SIN_CUOTA";

const pad2 = (n: number) => String(n).padStart(2, "0");

function partes(periodo: Periodo): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new RangeError(`Período inválido: ${periodo}`);
  return [Number(m[1]), Number(m[2])];
}

/** Período (mes calendario en hora argentina) al que pertenece un instante. */
export function periodoDe(fecha: Date): Periodo {
  const w = toGymWallClock(fecha);
  return `${w.getUTCFullYear()}-${pad2(w.getUTCMonth() + 1)}`;
}

export function sumarPeriodos(periodo: Periodo, n: number): Periodo {
  const [y, m] = partes(periodo);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

export function diasDelPeriodo(periodo: Periodo): number {
  const [y, m] = partes(periodo);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 00:00:00.000 del día 1, hora argentina. */
export function inicioDePeriodo(periodo: Periodo): Date {
  partes(periodo);
  return new Date(`${periodo}-01T00:00:00.000-03:00`);
}

/** 23:59:59.999 del último día del mes, hora argentina. */
export function finDePeriodo(periodo: Periodo): Date {
  partes(periodo);
  return new Date(`${periodo}-${pad2(diasDelPeriodo(periodo))}T23:59:59.999-03:00`);
}

/** Último instante en que se puede pagar el período sin estar vencido: fin del día `diaLimite + gracia`. */
export function fechaLimitePago(periodo: Periodo, diaLimite: number, gracia = 0): Date {
  const dia = Math.min(diaLimite + gracia, diasDelPeriodo(periodo));
  return new Date(`${periodo}-${pad2(dia)}T23:59:59.999-03:00`);
}

function validarPrecio(precio: number) {
  if (!Number.isFinite(precio) || precio < 0) throw new RangeError("El precio debe ser un número mayor o igual a 0");
}

function validarDiaCorte(diaCorte: number) {
  if (!Number.isInteger(diaCorte) || diaCorte < 1 || diaCorte > 31) {
    throw new RangeError("El día de corte debe ser un entero entre 1 y 31");
  }
}

/** Proporción de la cuota, redondeada al centavo (aritmética en centavos enteros). */
function prorratear(precio: number, dias: number, diasDelMes: number): number {
  return Math.round((Math.round(precio * 100) * dias) / diasDelMes) / 100;
}

/**
 * Alta (o reingreso) en `fechaAlta`. Hasta el día de corte inclusive se prorratea el mes en curso
 * (contando el día del alta); después del corte se cobra una cuota completa que cubre lo que
 * queda del mes y el mes siguiente.
 */
export function calcularAlta(input: { fechaAlta: Date; precio: number; diaCorte: number }): PlanDePago {
  const { fechaAlta, precio, diaCorte } = input;
  validarPrecio(precio);
  validarDiaCorte(diaCorte);

  const periodo = periodoDe(fechaAlta);
  const dia = toGymWallClock(fechaAlta).getUTCDate();
  const diasDelMes = diasDelPeriodo(periodo);
  const cubreDesde = new Date(`${periodo}-${pad2(dia)}T00:00:00.000-03:00`);

  if (dia <= diaCorte) {
    return {
      tipo: "ALTA_PRORRATEO",
      periodos: [periodo],
      monto: prorratear(precio, diasDelMes - dia + 1, diasDelMes),
      cubreDesde,
      cubreHasta: finDePeriodo(periodo),
    };
  }

  const siguiente = sumarPeriodos(periodo, 1);
  return {
    tipo: "ALTA_COMPLETA",
    periodos: [periodo, siguiente],
    monto: Math.round(precio * 100) / 100,
    cubreDesde,
    cubreHasta: finDePeriodo(siguiente),
  };
}

/**
 * Qué hay que cobrarle hoy a un socio, según hasta qué período tiene cubierto.
 * - Si no tiene cobertura en el mes anterior ni en el actual (nunca pagó o dejó pasar un mes
 *   entero) se trata como alta: no se cobra deuda retroactiva.
 * - Si no, es una renovación: el período siguiente al último cubierto, completo y sin recargo
 *   (también si paga tarde o por adelantado).
 */
export function planDePago(input: {
  ultimoPeriodoCubierto: Periodo | null;
  hoy: Date;
  precio: number;
  diaCorte: number;
}): PlanDePago {
  const { ultimoPeriodoCubierto, hoy, precio, diaCorte } = input;
  const actual = periodoDe(hoy);

  if (ultimoPeriodoCubierto === null || ultimoPeriodoCubierto < sumarPeriodos(actual, -1)) {
    return calcularAlta({ fechaAlta: hoy, precio, diaCorte });
  }

  validarPrecio(precio);
  const periodo = sumarPeriodos(ultimoPeriodoCubierto, 1);
  return {
    tipo: "RENOVACION",
    periodos: [periodo],
    monto: Math.round(precio * 100) / 100,
    cubreDesde: inicioDePeriodo(periodo),
    cubreHasta: finDePeriodo(periodo),
  };
}

/**
 * Estado de pago del socio hoy (se calcula al consultar; no hay proceso que lo actualice).
 * - AL_DIA: el mes actual está cubierto.
 * - PENDIENTE: no pagó el mes actual pero está dentro del plazo (día límite + gracia): entra con aviso.
 * - VENCIDA: pasó el plazo, o dejó pasar más de un mes: no entra sin autorización.
 * - SIN_CUOTA: nunca pagó.
 */
export function estadoCuotaSocio(input: {
  ultimoPeriodoCubierto: Periodo | null;
  hoy: Date;
  diaLimite: number;
  gracia?: number;
}): EstadoCuotaSocio {
  const { ultimoPeriodoCubierto, hoy, diaLimite, gracia = 0 } = input;
  if (ultimoPeriodoCubierto === null) return "SIN_CUOTA";

  const actual = periodoDe(hoy);
  if (ultimoPeriodoCubierto >= actual) return "AL_DIA";
  if (ultimoPeriodoCubierto === sumarPeriodos(actual, -1) && hoy.getTime() <= fechaLimitePago(actual, diaLimite, gracia).getTime()) {
    return "PENDIENTE";
  }
  return "VENCIDA";
}
