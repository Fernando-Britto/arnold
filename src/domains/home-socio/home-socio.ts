/**
 * Home_Socio — pure business-rule / derivation functions.
 * Spec: openspec/specs/home-socio-portal/spec.md
 *
 * These functions intentionally take already-fetched data (arrays of dates,
 * raw counts) rather than querying Prisma directly: they stay pure and fully
 * unit-tested. The Prisma queries live in src/api/home-socio-data.ts, which
 * feeds them (T-028, GET /api/home-socio).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** AC-005: percentage of capacity currently occupied. */
export function computeAforoPercentage(
  ocupacionActual: number,
  capacidadMaxima: number
): number {
  if (!capacidadMaxima || capacidadMaxima <= 0) {
    return 0;
  }
  const pct = Math.round((ocupacionActual / capacidadMaxima) * 100);
  return Math.min(pct, 100);
}

export type EstadoMembresia = "AL_DIA" | "POR_VENCER" | "VENCIDA";

export interface MembresiaStatus {
  diasRestantes: number;
  estado: EstadoMembresia;
  /** AC-007: true iff diasRestantes <= 7 — this also covers the "already
   * expired" edge case, since a negative day count is always <= 7. */
  mostrarRenovar: boolean;
}

/** AC-007 + Edge Cases: membership status and whether to prompt renewal. */
export function computeMembresiaStatus(
  fechaVencimiento: Date,
  hoy: Date
): MembresiaStatus {
  const diasRestantes = Math.round(
    (fechaVencimiento.getTime() - hoy.getTime()) / MS_PER_DAY
  );
  const estado: EstadoMembresia =
    diasRestantes < 0 ? "VENCIDA" : diasRestantes <= 7 ? "POR_VENCER" : "AL_DIA";

  return {
    diasRestantes,
    estado,
    mostrarRenovar: diasRestantes <= 7,
  };
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

/**
 * AC-006: maps attendance dates onto the CALENDAR Mon–Sun week containing
 * `hoy` (not a rolling 7-day window). Returns 7 booleans, index 0 = Monday.
 */
export function computeDiasAsistidosSemana(
  fechasAsistencia: Date[],
  hoy: Date
): boolean[] {
  const monday = startOfWeekMonday(hoy);
  const result = new Array(7).fill(false);

  for (const fecha of fechasAsistencia) {
    const diff = Math.floor(
      (Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()) -
        monday.getTime()) /
        MS_PER_DAY
    );
    if (diff >= 0 && diff < 7) {
      result[diff] = true;
    }
  }

  return result;
}

export interface DiaCalendario {
  /** Day of the month (e.g. 24). */
  numero: number;
  asistio: boolean;
  esHoy: boolean;
}

/** RachaSemanal weekly calendar: the Mon–Sun week containing `hoy`, with the
 * day-of-month number, whether the Socio attended, and which day is today. */
export function buildSemanaCalendario(
  fechasAsistencia: Date[],
  hoy: Date
): DiaCalendario[] {
  const monday = startOfWeekMonday(hoy);
  const asistidos = computeDiasAsistidosSemana(fechasAsistencia, hoy);
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());

  return asistidos.map((asistio, i) => {
    const dia = new Date(monday.getTime() + i * MS_PER_DAY);
    return {
      numero: dia.getUTCDate(),
      asistio,
      esHoy: dia.getTime() === hoyUTC,
    };
  });
}

/**
 * Streak in consecutive calendar weeks with at least one attendance.
 * The current week counts if it already has attendance; if it doesn't yet,
 * the streak is measured from last week (the week isn't over, so it hasn't
 * been "broken").
 */
export function computeRachaSemanas(fechasAsistencia: Date[], hoy: Date): number {
  const currentMonday = startOfWeekMonday(hoy).getTime();
  const semanasConAsistencia = new Set<number>();
  for (const fecha of fechasAsistencia) {
    semanasConAsistencia.add(startOfWeekMonday(fecha).getTime());
  }

  let cursor = semanasConAsistencia.has(currentMonday)
    ? currentMonday
    : currentMonday - 7 * MS_PER_DAY;

  let racha = 0;
  while (semanasConAsistencia.has(cursor)) {
    racha += 1;
    cursor -= 7 * MS_PER_DAY;
  }
  return racha;
}

export interface Dias28Result {
  /** 4 rows × 7 columns, row-major. index 0 = Monday 3 weeks before the
   * current week; index 27 = Sunday of the current week. */
  dias: boolean[];
  total: number;
}

/**
 * StravaWidget (spec: "Últimas 4 semanas", inside MembresiCard): a 4-week ×
 * 7-day attendance grid aligned to calendar weeks so each column is a real
 * weekday (L M X J V S D); the last row is the current week.
 */
export function compute28DiasAsistencia(
  fechasAsistencia: Date[],
  hoy: Date
): Dias28Result {
  const gridStart = startOfWeekMonday(hoy).getTime() - 21 * MS_PER_DAY;
  const dias = new Array(28).fill(false);

  for (const fecha of fechasAsistencia) {
    const fechaUTC = Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate()
    );
    const index = Math.round((fechaUTC - gridStart) / MS_PER_DAY);
    if (index >= 0 && index < 28) {
      dias[index] = true;
    }
  }

  return { dias, total: dias.filter(Boolean).length };
}

export interface RutinaAsignadaRef {
  id: string;
  fechaAsignacion: Date;
  rutinaId: string;
}

export interface SelectRutinaActivaResult {
  rutinaAsignada: RutinaAsignadaRef | null;
  /** AC-002: true when more than one active assignment was found — the
   * caller should log this as a data-integrity anomaly for admin review. */
  isAnomaly: boolean;
}

/**
 * RN-04 / AC-002: a Socio must have exactly one active Rutina assignment.
 * If the data layer ever returns more than one (a data-integrity bug
 * upstream), this surfaces the earliest by assignment date and flags the
 * anomaly instead of silently picking one or crashing.
 */
export function selectRutinaActiva(
  asignacionesActivas: RutinaAsignadaRef[]
): SelectRutinaActivaResult {
  if (asignacionesActivas.length === 0) {
    return { rutinaAsignada: null, isAnomaly: false };
  }

  if (asignacionesActivas.length === 1) {
    return { rutinaAsignada: asignacionesActivas[0], isAnomaly: false };
  }

  const sorted = [...asignacionesActivas].sort(
    (a, b) => a.fechaAsignacion.getTime() - b.fechaAsignacion.getTime()
  );
  return { rutinaAsignada: sorted[0], isAnomaly: true };
}

/** Incremento de carga sugerido si no hay una ReglaDeProgresion configurada (supuesto, ver decisions.md). */
export const DEFAULT_INCREMENTO_KG = 2.5;

const VENTANA_PROGRESO_DIAS = 28;
const GYM_OFFSET_MS = -3 * 60 * 60 * 1000;

export interface RegistroProgresoRef {
  ejercicioId: string;
  ejercicioNombre: string;
  /** kg */
  carga: number;
  fecha: Date;
}

export interface ProgresoActualResult {
  ejercicioNombre: string;
  marcaActual: number;
  deltaEsteMes: number;
  progresionCarga: { fecha: string; carga: number }[];
  proximaSesionSugerida: number;
}

/**
 * ProgresoSection: progresión de UN ejercicio en las últimas 4 semanas.
 * Reglas (la spec no las fija; son supuestos documentados en decisions.md):
 * - ejercicio = el del registro más reciente de la ventana;
 * - un punto por día (hora del gimnasio) con la mayor carga de ese día;
 * - marcaActual = carga del último punto; deltaEsteMes = último − primero de la ventana;
 * - próxima sesión sugerida = marcaActual + incremento (ReglaDeProgresion o DEFAULT_INCREMENTO_KG).
 * Sin registros en la ventana → null (estado vacío, la spec lo pide).
 */
export function computeProgresoActual(
  registros: RegistroProgresoRef[],
  hoy: Date,
  incrementoSugerido: number
): ProgresoActualResult | null {
  const desde = hoy.getTime() - VENTANA_PROGRESO_DIAS * MS_PER_DAY;
  const enVentana = registros.filter((r) => r.fecha.getTime() >= desde);
  if (enVentana.length === 0) return null;

  const ultimo = enVentana.reduce((a, b) => (b.fecha > a.fecha ? b : a));
  const mejorPorDia = new Map<string, number>();
  for (const r of enVentana) {
    if (r.ejercicioId !== ultimo.ejercicioId) continue;
    const dia = new Date(r.fecha.getTime() + GYM_OFFSET_MS).toISOString().slice(0, 10);
    mejorPorDia.set(dia, Math.max(mejorPorDia.get(dia) ?? -Infinity, r.carga));
  }

  const progresionCarga = [...mejorPorDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, carga]) => ({ fecha, carga }));
  const marcaActual = progresionCarga[progresionCarga.length - 1].carga;

  return {
    ejercicioNombre: ultimo.ejercicioNombre,
    marcaActual,
    deltaEsteMes: marcaActual - progresionCarga[0].carga,
    progresionCarga,
    proximaSesionSugerida: marcaActual + incrementoSugerido,
  };
}
