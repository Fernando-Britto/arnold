/**
 * Secciones del socio (T-039, D-45): funciones puras de agregación para las pantallas
 * "Mi rutina", "Mis ejercicios", "Progreso", "Mis pagos y membresía" y "Mis asistencias".
 *
 * Igual que `./home-socio`, reciben datos ya consultados (no tocan Prisma) para poder
 * probarse sin base. Las consultas viven en `src/api/home-socio-secciones-data.ts`.
 * Las fechas que llegan ya vienen en "hora de pared" del gimnasio (toGymWallClock): acá
 * se usan los getters `getUTC*` y `getUTCDate` para que "día" sea el día argentino.
 */
import {
  computeRachaSemanas,
  type DiaCalendario,
} from "./home-socio";
import {
  estadoCuotaSocio,
  periodoDe,
  type EstadoCuotaSocio,
  type Periodo,
} from "@/domains/pago/cuota";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GYM_OFFSET_MS = -3 * 60 * 60 * 1000;

export interface RegistroProgresoRef {
  ejercicioId: string;
  ejercicioNombre: string;
  /** kg */
  carga: number;
  repeticiones: number;
  fecha: Date;
}

export interface PuntoProgreso {
  /** Fecha ISO (YYYY-MM-DD) en hora del gimnasio. */
  fecha: string;
  carga: number;
}

/** Mejor marca (carga máxima) por ejercicio, considerando TODOS los registros. */
export function computeMejoresMarcas(registros: RegistroProgresoRef[]): Map<string, number> {
  const marcas = new Map<string, number>();
  for (const r of registros) {
    const actual = marcas.get(r.ejercicioId);
    if (actual === undefined || r.carga > actual) marcas.set(r.ejercicioId, r.carga);
  }
  return marcas;
}

export interface ProgresoEjercicioResumen {
  ejercicioId: string;
  ejercicioNombre: string;
  serie: PuntoProgreso[];
  mejorMarca: number;
  /** Último punto − primero de la serie (0 con un solo punto). */
  delta: number;
}

/**
 * Serie de progreso por ejercicio: un punto por día del gimnasio con la mayor carga de ese
 * día, en orden cronológico. Solo ejercicios con registros dentro de la ventana.
 */
export function computeProgresoPorEjercicio(
  registros: RegistroProgresoRef[],
  hoy: Date,
  ventanaDias = 84
): ProgresoEjercicioResumen[] {
  const desde = hoy.getTime() - ventanaDias * MS_PER_DAY;
  const enVentana = registros.filter((r) => r.fecha.getTime() >= desde);

  const porEjercicio = new Map<string, { nombre: string; porDia: Map<string, number> }>();
  for (const r of enVentana) {
    const entry = porEjercicio.get(r.ejercicioId) ?? { nombre: r.ejercicioNombre, porDia: new Map<string, number>() };
    const dia = new Date(r.fecha.getTime() + GYM_OFFSET_MS).toISOString().slice(0, 10);
    entry.porDia.set(dia, Math.max(entry.porDia.get(dia) ?? -Infinity, r.carga));
    porEjercicio.set(r.ejercicioId, entry);
  }

  return [...porEjercicio.entries()]
    .map(([ejercicioId, { nombre, porDia }]) => {
      const serie = [...porDia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, carga]) => ({ fecha, carga }));
      return {
        ejercicioId,
        ejercicioNombre: nombre,
        serie,
        mejorMarca: serie.reduce((m, p) => Math.max(m, p.carga), 0),
        delta: serie.length > 1 ? serie[serie.length - 1].carga - serie[0].carga : 0,
      };
    })
    .sort((a, b) => a.ejercicioNombre.localeCompare(b.ejercicioNombre));
}

export interface AsistenciaDia {
  /** Fecha ISO (YYYY-MM-DD) en hora del gimnasio. */
  fecha: string;
  asistio: boolean;
}

export interface CalendarioAsistencias {
  /** `dias` entradas, de la más vieja a hoy. */
  dias: AsistenciaDia[];
  total: number;
}

/**
 * Calendario de asistencias: ventana de `dias` días del gimnasio terminando hoy, con la
 * marca de asistencia por día. Varias visitas del mismo día cuentan una sola vez.
 */
export function buildCalendarioAsistencias(
  fechasAsistencia: Date[],
  hoy: Date,
  dias = 35
): CalendarioAsistencias {
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const inicio = hoyUTC - (dias - 1) * MS_PER_DAY;

  const asistidos = new Set<number>();
  for (const fecha of fechasAsistencia) {
    const d = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
    if (d >= inicio && d <= hoyUTC) asistidos.add(d);
  }

  const resultado: AsistenciaDia[] = [];
  for (let i = 0; i < dias; i++) {
    const t = inicio + i * MS_PER_DAY;
    resultado.push({ fecha: new Date(t).toISOString().slice(0, 10), asistio: asistidos.has(t) });
  }

  return { dias: resultado, total: resultado.filter((d) => d.asistio).length };
}

/** Racha de semanas consecutivas con al menos una asistencia (misma regla que Home_Socio). */
export function computeRachaDeAsistencias(fechasAsistencia: Date[], hoy: Date): number {
  return computeRachaSemanas(fechasAsistencia, hoy);
}

export interface PagoRef {
  id: string;
  fechaPago: Date;
  monto: number;
  metodoPago: string;
  cuota: { fechaVencimiento: Date } | null;
}

export interface PagoHistorial {
  id: string;
  fechaPago: string;
  monto: number;
  metodoPago: string;
  /** Período cubierto (YYYY-MM), o null si el pago no está ligado a una cuota. */
  periodo: Periodo | null;
}

export interface MembresiaResumen {
  /** Estado de pago calculado (D-40/D-46): nunca se persiste. */
  estado: EstadoCuotaSocio;
  ultimoPeriodoCubierto: Periodo | null;
  fechaVencimiento: string | null;
  historial: PagoHistorial[];
}

/**
 * Resumen de pagos y membresía: historial + cobertura actual + estado de pago calculado con
 * `estadoCuotaSocio` (D-40). `ultimaCuota` es la cuota con el vencimiento más lejano.
 */
export function resumirMembresia(input: {
  pagos: PagoRef[];
  ultimaCuota: { fechaVencimiento: Date } | null;
  hoy: Date;
  diaLimite: number;
  gracia?: number;
}): MembresiaResumen {
  const { pagos, ultimaCuota, hoy, diaLimite, gracia = 0 } = input;
  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;

  return {
    estado: estadoCuotaSocio({ ultimoPeriodoCubierto, hoy, diaLimite, gracia }),
    ultimoPeriodoCubierto,
    fechaVencimiento: ultimaCuota ? ultimaCuota.fechaVencimiento.toISOString() : null,
    historial: pagos.map((p) => ({
      id: p.id,
      fechaPago: p.fechaPago.toISOString(),
      monto: p.monto,
      metodoPago: p.metodoPago,
      periodo: p.cuota ? periodoDe(p.cuota.fechaVencimiento) : null,
    })),
  };
}

export interface SesionRef {
  id: string;
  horaInicio: Date;
  horaFin: Date | null;
  estado: string;
}

export interface SesionResumen {
  id: string;
  horaInicio: string;
  horaFin: string | null;
  estado: string;
  duracionMin: number | null;
}

/** Historial de sesiones con la duración calculada (null si sigue en curso). */
export function resumirSesiones(sesiones: SesionRef[]): SesionResumen[] {
  return sesiones.map((s) => ({
    id: s.id,
    horaInicio: s.horaInicio.toISOString(),
    horaFin: s.horaFin ? s.horaFin.toISOString() : null,
    estado: s.estado,
    duracionMin: s.horaFin
      ? Math.max(0, Math.round((s.horaFin.getTime() - s.horaInicio.getTime()) / 60000))
      : null,
  }));
}

export type { DiaCalendario };
