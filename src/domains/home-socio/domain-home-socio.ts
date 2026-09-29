/**
 * Home_Socio — pure business-rule / derivation functions.
 * Spec: openspec/specs/home-socio-portal/spec.md
 *
 * These functions intentionally take already-fetched data (arrays of dates,
 * raw counts) rather than querying Prisma directly. Reasoning: Asistencia,
 * RegistroDeProgreso, SesionDeEntrenamiento, Cuota and ConfiguracionDelSistema
 * exist in prisma/schema.prisma but have no domain/repository layer yet
 * (unlike Ejercicio/Rutina/Cliente/Membresía). Wiring a real
 * `/api/home-socio` endpoint against those models is a separate, sizeable
 * slice of work — this module keeps the *business rules* honest and fully
 * tested now, and the page consumes them through a mockable
 * `fetchHomeSocioData` (see src/api/home-socio.ts) until that endpoint
 * exists.
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
