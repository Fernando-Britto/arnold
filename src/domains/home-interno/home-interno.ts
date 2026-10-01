/**
 * Home_Interno — pure business-rule / derivation functions.
 * Spec: openspec/specs/home-interno-dashboard/spec.md
 * Same pattern as src/domains/home-socio/home-socio.ts: these take
 * already-fetched arrays rather than querying Prisma directly, since
 * Máquina/Pago/Asistencia aggregation has no repository layer yet.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EstadoMaquina = "DISPONIBLE" | "OCUPADA" | "FUERA_DE_SERVICIO" | "INACTIVA";

export interface EstadoEquiposResult {
  porcentaje: number;
  /** Only "Fuera de Servicio" machines — matches the footer wording
   * ("N en mantenimiento"), Inactiva machines are excluded from the
   * numerator too but aren't described as "in maintenance". */
  enMantenimiento: number;
}

/** RN-05 / AC-005: Fuera de Servicio and Inactiva are excluded from the
 * numerator (they don't count as operational), but not from the total. */
export function computeEstadoEquipos(
  maquinas: { estado: EstadoMaquina }[]
): EstadoEquiposResult {
  const total = maquinas.length;
  if (total === 0) {
    return { porcentaje: 0, enMantenimiento: 0 };
  }
  const operativas = maquinas.filter(
    (m) => m.estado !== "FUERA_DE_SERVICIO" && m.estado !== "INACTIVA"
  ).length;
  const enMantenimiento = maquinas.filter((m) => m.estado === "FUERA_DE_SERVICIO").length;

  return {
    porcentaje: Math.round((operativas / total) * 100),
    enMantenimiento,
  };
}

export interface SociosInactivosResult {
  cantidad: number;
  footer: string;
}

/** A Socio counts as inactive when they never attended, or their last
 * Asistencia is older than `diasInactividad` days. */
export function computeSociosInactivos(
  ultimasAsistencias: (Date | null)[],
  diasInactividad: number,
  hoy: Date
): SociosInactivosResult {
  const cantidad = ultimasAsistencias.filter((fecha) => {
    if (!fecha) return true;
    const dias = (hoy.getTime() - fecha.getTime()) / MS_PER_DAY;
    return dias > diasInactividad;
  }).length;

  return { cantidad, footer: `Sin visita > ${diasInactividad} días` };
}

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA";

export interface Pago {
  monto: number;
  metodoPago: MetodoPago;
  estado: "CONFIRMADO" | string;
  fecha: Date;
}

export interface CajaHoyResult {
  efectivo: number;
  transferencia: number;
  total: number;
}

function esMismoDia(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** AC-004: sum of confirmed Pago.monto for today, grouped by metodoPago. */
export function computeCajaHoy(pagos: Pago[], hoy: Date): CajaHoyResult {
  const deHoy = pagos.filter((p) => p.estado === "CONFIRMADO" && esMismoDia(p.fecha, hoy));
  const efectivo = deHoy
    .filter((p) => p.metodoPago === "EFECTIVO")
    .reduce((sum, p) => sum + p.monto, 0);
  const transferencia = deHoy
    .filter((p) => p.metodoPago === "TRANSFERENCIA")
    .reduce((sum, p) => sum + p.monto, 0);

  return { efectivo, transferencia, total: efectivo + transferencia };
}

export type ActivityEventType =
  | "PAGO"
  | "ALTA_SOCIO"
  | "BAJA_SOCIO"
  | "ANULACION_PAGO"
  | "ASIGNACION_RUTINA"
  | "INGRESO";

export interface ActivityEvent {
  tipo: ActivityEventType;
  nombre: string;
  descripcion: string;
  fecha: Date;
}

const TIPOS_EN_FEED: ActivityEventType[] = [
  "PAGO",
  "ALTA_SOCIO",
  "BAJA_SOCIO",
  "ANULACION_PAGO",
  "ASIGNACION_RUTINA",
];

/**
 * Spec: only 5 event types populate Col_Actividad. INGRESO (check-ins) is
 * explicitly excluded — "too frequent, no additional signal beyond Aforo" —
 * even though the design mock's example data shows one; the written
 * business rule wins over the mock's filler data.
 * AC-007: at most the last 24h, newest first.
 */
export function filterActivityFeed(events: ActivityEvent[], hoy: Date): ActivityEvent[] {
  return events
    .filter((e) => TIPOS_EN_FEED.includes(e.tipo))
    .filter((e) => hoy.getTime() - e.fecha.getTime() <= 24 * 60 * 60 * 1000)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}
