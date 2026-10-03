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

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";

export interface Pago {
  monto: number;
  metodoPago: MetodoPago;
  estado: "CONFIRMADO" | string;
  fecha: Date;
}

export interface CajaHoyResult {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  total: number;
}

/** "Today" is a calendar day at the gym, not in UTC: a payment at 21:30 ART is
 * already the next day in UTC. */
export const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";

const diaEnGimnasio = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function esMismoDia(a: Date, b: Date): boolean {
  return diaEnGimnasio(a) === diaEnGimnasio(b);
}

/** AC-004: sum of confirmed Pago.monto for today, grouped by metodoPago. */
export function computeCajaHoy(pagos: Pago[], hoy: Date): CajaHoyResult {
  const deHoy = pagos.filter((p) => p.estado === "CONFIRMADO" && esMismoDia(p.fecha, hoy));
  const sumar = (metodo: MetodoPago) =>
    deHoy.filter((p) => p.metodoPago === metodo).reduce((sum, p) => sum + p.monto, 0);
  const efectivo = sumar("EFECTIVO");
  const transferencia = sumar("TRANSFERENCIA");
  const tarjeta = sumar("TARJETA");

  return { efectivo, transferencia, tarjeta, total: efectivo + transferencia + tarjeta };
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

// ---------------------------------------------------------------------------
// T-021a — Row_Hoy / Row_Operacion aggregation
// ---------------------------------------------------------------------------

/** Only `periodoGracia = 0` is documented by the spec as a fallback. The other
 * two are assumptions: capacidadMaxima 0 renders "Aforo no configurado" rather
 * than inventing a capacity, and diasInactividad 15 is the spec's own example. */
const CONFIG_DEFAULTS = { capacidadMaxima: 0, periodoGracia: 0, diasInactividad: 15 };

export interface AforoResult {
  ocupacionActual: number;
  capacidadMaxima: number;
  porcentaje: number;
}

/** AC-003. Percentage is capped at 100 for display but the true count is kept
 * (manual overrides can push occupancy over capacity). Never divides by zero. */
export function computeAforo(asistenciasActivas: number, capacidadMaxima: number | null): AforoResult {
  const capacidad = capacidadMaxima && capacidadMaxima > 0 ? capacidadMaxima : 0;
  const porcentaje =
    capacidad === 0 ? 0 : Math.min(100, Math.round((asistenciasActivas / capacidad) * 100));
  return { ocupacionActual: asistenciasActivas, capacidadMaxima: capacidad, porcentaje };
}

export interface CuotaPorVencer {
  socioId: string;
  socioNombre: string;
  fechaVencimiento: Date;
}

export interface AlertaVencimiento {
  socioId: string;
  texto: string;
  detalle: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/** AC-002 / RN-02: a "Vencimiento" alert exists when the cuota expires within
 * the next 24h, or is already past due but still inside `periodoGracia` days.
 * Most overdue first. */
export function computeAlertasVencimiento(
  cuotas: CuotaPorVencer[],
  periodoGracia: number | null,
  hoy: Date
): AlertaVencimiento[] {
  const gracia = periodoGracia ?? CONFIG_DEFAULTS.periodoGracia;
  const desde = hoy.getTime() - gracia * MS_PER_DAY;
  const hasta = hoy.getTime() + 24 * MS_PER_HOUR;

  return cuotas
    .filter((c) => c.fechaVencimiento.getTime() >= desde && c.fechaVencimiento.getTime() <= hasta)
    .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())
    .map((c) => {
      const diff = c.fechaVencimiento.getTime() - hoy.getTime();
      const dias = Math.floor(-diff / MS_PER_DAY);
      const detalle =
        diff >= 0
          ? `Vence en ${Math.ceil(diff / MS_PER_HOUR)} h`
          : dias === 0
            ? "Venció hoy"
            : `Venció hace ${dias} ${dias === 1 ? "día" : "días"}`;
      return { socioId: c.socioId, texto: `Vencimiento · ${c.socioNombre}`, detalle };
    });
}

export interface PersonalResult {
  cantidad: number;
  footer: string;
}

/** "Personal en turno": INSTRUCTOR counts as entrenador, everyone else as staff. */
export function computePersonalEnTurno(
  personal: { rol: "ADMINISTRADOR" | "INSTRUCTOR" | "RECEPCIONISTA" }[]
): PersonalResult {
  if (personal.length === 0) return { cantidad: 0, footer: "Sin personal registrado" };
  const entrenadores = personal.filter((p) => p.rol === "INSTRUCTOR").length;
  const staff = personal.length - entrenadores;
  return {
    cantidad: personal.length,
    footer: `${entrenadores} ${entrenadores === 1 ? "entrenador" : "entrenadores"}, ${staff} staff`,
  };
}

export interface ActivityItemView {
  nombre: string;
  descripcion: string;
  haceTexto: string;
}

/** Renders a Date as "Hace N min" / "Hace 1 hora" / "Hace N horas" /
 * "Hace unos segundos", relative to `hoy`. */
export function formatHaceTiempo(fecha: Date, hoy: Date): string {
  const segundos = Math.floor((hoy.getTime() - fecha.getTime()) / 1000);
  if (segundos < 60) return "Hace unos segundos";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas === 1 ? "Hace 1 hora" : `Hace ${horas} horas`;
}

export interface HomeInternoRaw {
  config: { capacidadMaxima: number | null; periodoGracia: number | null; diasInactividad: number | null };
  maquinas: { estado: EstadoMaquina }[];
  pagos: Pago[];
  cuotas: CuotaPorVencer[];
  ultimasAsistencias: (Date | null)[];
  aforo: { asistenciasActivas: number; horas: { hora: number; ocupacion: number }[]; horaActual: number };
  personal: { rol: "ADMINISTRADOR" | "INSTRUCTOR" | "RECEPCIONISTA" }[];
  /** Live COUNT(*) per table (Row_Gestion, AC-006). */
  contadores: { rutinas: number; ejercicios: number; clientes: number; membresias: number };
  /** Unfiltered candidate events; the feed rules are applied in aggregateHomeInterno. */
  eventos: ActivityEvent[];
}

export interface OperationCardView {
  metric: string;
  footer: string;
}

export interface HomeInternoViewModel {
  alertas: AlertaVencimiento[];
  aforo: AforoResult & { horas: { hora: number; ocupacion: number }[]; horaActual: number };
  caja: CajaHoyResult;
  equipos: OperationCardView;
  personal: OperationCardView;
  inactivos: OperationCardView;
  gestion: { rutinas: string; ejercicios: string; clientes: string; membresias: string };
  actividad: ActivityItemView[];
}

/** Composes every zone's derivations (Hoy, Operación, Gestión, Actividad). `hoy` is the server's
 * "now" so every card is computed against the same instant. */
export function aggregateHomeInterno(
  raw: HomeInternoRaw,
  hoy: Date
): HomeInternoViewModel {
  const diasInactividad = raw.config.diasInactividad ?? CONFIG_DEFAULTS.diasInactividad;
  const equipos = computeEstadoEquipos(raw.maquinas);
  const personal = computePersonalEnTurno(raw.personal);
  const inactivos = computeSociosInactivos(raw.ultimasAsistencias, diasInactividad, hoy);

  return {
    alertas: computeAlertasVencimiento(raw.cuotas, raw.config.periodoGracia, hoy),
    aforo: {
      ...computeAforo(raw.aforo.asistenciasActivas, raw.config.capacidadMaxima),
      horas: raw.aforo.horas,
      horaActual: raw.aforo.horaActual,
    },
    caja: computeCajaHoy(raw.pagos, hoy),
    equipos: { metric: `${equipos.porcentaje}%`, footer: `${equipos.enMantenimiento} en mantenimiento` },
    personal: { metric: String(personal.cantidad), footer: personal.footer },
    inactivos: { metric: String(inactivos.cantidad), footer: inactivos.footer },
    gestion: {
      rutinas: String(raw.contadores.rutinas),
      ejercicios: String(raw.contadores.ejercicios),
      clientes: String(raw.contadores.clientes),
      membresias: String(raw.contadores.membresias),
    },
    actividad: filterActivityFeed(raw.eventos, hoy).map((e) => ({
      nombre: e.nombre,
      descripcion: e.descripcion,
      haceTexto: formatHaceTiempo(e.fecha, hoy),
    })),
  };
}
