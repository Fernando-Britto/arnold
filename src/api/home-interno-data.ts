import { prisma } from "@/lib/db";
import { hourInGym, startOfGymDay, turnoActual } from "@/lib/gym-time";
import type { HomeInternoDTO } from "@/api/home-interno";

/**
 * Server-side: builds the GET /api/home-interno payload (the wire contract in
 * src/api/home-interno.ts) from the database. Never import this from client
 * code — it pulls in Prisma. Spec: openspec/specs/home-interno-dashboard.
 *
 * Only RAW facts are collected here. The business rules (grace period, today's
 * cash in ART, the 24h feed, percentages…) live in the domain layer and run in
 * `aggregateHomeInterno`, so they stay unit-tested and in one place.
 *
 * Assumptions not defined by the spec (change them here):
 * - Shift boundaries: see src/lib/gym-time.ts (Mañana 06–14, Tarde 14–22, Noche 22–06).
 * - Aforo bars: 2-hour slots 06–22, counting today's PERMITIDO check-ins per slot.
 * - "Active" attendance = a PERMITIDO check-in inside `ventanaAforoMinutos`
 *   (Asistencia has no check-out), default 90 per the schema.
 * - "Baja de socio" = a SOCIO user soft-deleted (`deletedAt`) in the last 24h.
 *
 * Rendimiento (P-07 / D-35): Prisma resuelve cada relación anidada con una consulta APARTE y EN CADENA
 * (padre y después hijo). Con una base lejana (~0,1–0,4 s por viaje) eso suma segundos. Por eso acá
 * NINGUNA consulta anida relaciones: son 14 consultas planas que salen todas juntas, en una sola ronda,
 * y el cruce (nombre del socio, plan, rutina) se hace en memoria. La guardia está en el test
 * ("ninguna consulta anida relaciones" y "una sola ronda"). Los filtros por relación (`where`) sí
 * valen: se resuelven con un JOIN dentro de la misma consulta.
 * - La ventana de aforo se recorta a MAX_VENTANA_AFORO_MIN: así la consulta de asistencias no necesita
 *   esperar a la configuración para saber desde cuándo traer (eso era un viaje de más).
 */
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_VENTANA_AFORO_MIN = 90;
const MAX_VENTANA_AFORO_MIN = 6 * 60; // tope razonable para "personas adentro ahora"
const MAX_EVENTOS = 50;
const SLOTS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

type StaffRol = "ADMINISTRADOR" | "INSTRUCTOR" | "RECEPCIONISTA";
const STAFF: string[] = ["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"];

export function buildAforoHoras(fechas: Date[], now: Date) {
  const horas = SLOTS.map((hora) => ({ hora, ocupacion: 0 }));
  for (const f of fechas) {
    const slot = Math.floor(hourInGym(f) / 2) * 2;
    const bar = horas.find((h) => h.hora === slot);
    if (bar) bar.ocupacion += 1;
  }
  return { horas, horaActual: Math.floor(hourInGym(now) / 2) * 2 };
}

export async function buildHomeInternoPayload(now: Date = new Date()): Promise<HomeInternoDTO> {
  const hace24h = new Date(now.getTime() - 24 * HOUR_MS);
  // 36h back always covers the whole gym day (≤24h) whatever the time zone offset.
  const hace36h = new Date(now.getTime() - 36 * HOUR_MS);
  const inicioDia = startOfGymDay(now);
  // Asistencias: desde el inicio del día del gimnasio o desde el tope de la ventana, lo que sea más antiguo.
  const desdeAsistencias = new Date(Math.min(inicioDia.getTime(), now.getTime() - MAX_VENTANA_AFORO_MIN * 60 * 1000));

  // UNA sola ronda: ninguna consulta depende de otra ni anida relaciones (ver nota de la cabecera).
  const [
    config, maquinas, pagosRecientes, socios, usuariosSocio, ultimasCuotas, ultimasVisitas,
    asistencias, personal, rutinas, ejercicios, planes, asignaciones, rutinasAsignadas,
  ] = await Promise.all([
    prisma.configuracionDelSistema.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.maquina.findMany({ select: { estado: true } }),
    // Una sola consulta alimenta la caja (CONFIRMADO, día argentino) y el feed de 24 h (CONFIRMADO + ANULADO).
    prisma.pago.findMany({
      where: { estado: { in: ["CONFIRMADO", "ANULADO"] }, fechaPago: { gte: hace36h } },
      select: { estado: true, monto: true, metodoPago: true, fechaPago: true, socioId: true },
    }),
    prisma.socio.findMany({ select: { id: true, usuarioId: true, membresiaAsignadaId: true, fechaAlta: true } }),
    prisma.usuario.findMany({ where: { rol: "SOCIO" }, select: { id: true, nombre: true, estado: true, deletedAt: true } }),
    // Última cuota y última visita por socio, agregadas en la base: una fila por socio en vez de traer todo el historial.
    prisma.cuota.groupBy({ by: ["socioId"], _max: { fechaVencimiento: true } }),
    prisma.asistencia.groupBy({ by: ["socioId"], where: { estado: "PERMITIDO" }, _max: { fechaHora: true } }),
    prisma.asistencia.findMany({
      where: { estado: "PERMITIDO", fechaHora: { gte: desdeAsistencias } },
      select: { fechaHora: true },
    }),
    // Personal en turno: filtro por la relación 1:1 con Empleado (un JOIN), sin traer el Empleado.
    prisma.usuario.findMany({
      where: { estado: "ACTIVO", deletedAt: null, empleado: { is: { estadoLaboral: "ACTIVO", turno: turnoActual(now) } } },
      select: { rol: true },
    }),
    prisma.rutina.count(),
    prisma.ejercicio.count(),
    prisma.membresia.findMany({ select: { id: true, nombre: true } }),
    prisma.rutinaAsignada.findMany({
      where: { fechaAsignacion: { gte: hace24h } },
      orderBy: { fechaAsignacion: "desc" },
      take: MAX_EVENTOS,
      select: { fechaAsignacion: true, socioId: true, rutinaId: true },
    }),
    prisma.rutina.findMany({
      where: { asignaciones: { some: { fechaAsignacion: { gte: hace24h } } } },
      select: { id: true, nombre: true },
    }),
  ]);

  const ventanaMin = Math.min(config?.ventanaAforoMinutos ?? DEFAULT_VENTANA_AFORO_MIN, MAX_VENTANA_AFORO_MIN);
  const desdeVentana = new Date(now.getTime() - ventanaMin * 60 * 1000);

  const entradasDeHoy = asistencias.map((a) => a.fechaHora).filter((f) => f >= inicioDia);
  const { horas, horaActual } = buildAforoHoras(entradasDeHoy, now);

  // --- Cruces en memoria ---
  const usuarioPorId = new Map(usuariosSocio.map((u) => [u.id, u]));
  const socioPorId = new Map(socios.map((s) => [s.id, s]));
  const planPorId = new Map(planes.map((m) => [m.id, m.nombre]));
  const rutinaPorId = new Map(rutinasAsignadas.map((r) => [r.id, r.nombre]));
  const cuotaPorSocio = new Map(ultimasCuotas.map((c) => [c.socioId, c._max.fechaVencimiento]));
  const visitaPorSocio = new Map(ultimasVisitas.map((v) => [v.socioId, v._max.fechaHora]));
  const nombreDeSocio = (socioId: string | null | undefined) => {
    const socio = socioId ? socioPorId.get(socioId) : undefined;
    return socio ? usuarioPorId.get(socio.usuarioId)?.nombre : undefined;
  };

  // Padrón activo: socios cuyo usuario está ACTIVO y no dado de baja.
  const padron = socios.filter((s) => {
    const u = usuarioPorId.get(s.usuarioId);
    return u !== undefined && u.estado === "ACTIVO" && u.deletedAt === null;
  });
  const clientes = socios.filter((s) => usuarioPorId.get(s.usuarioId)?.deletedAt === null).length;

  const eventos: HomeInternoDTO["eventos"] = [
    ...pagosRecientes
      .filter((p) => p.fechaPago >= hace24h)
      .map((p) => {
        const anulado = p.estado === "ANULADO";
        const socio = p.socioId ? socioPorId.get(p.socioId) : undefined;
        const plan = socio?.membresiaAsignadaId ? planPorId.get(socio.membresiaAsignadaId) : undefined;
        return {
          tipo: anulado ? ("ANULACION_PAGO" as const) : ("PAGO" as const),
          nombre: nombreDeSocio(p.socioId) ?? "Pago sin socio",
          descripcion: anulado ? "Pago anulado" : plan ? `Pago de membresía ${plan}` : "Pago registrado",
          fecha: p.fechaPago.toISOString(),
        };
      }),
    ...socios
      .filter((s) => s.fechaAlta >= hace24h)
      .map((s) => ({
        tipo: "ALTA_SOCIO" as const,
        nombre: usuarioPorId.get(s.usuarioId)?.nombre ?? "Socio",
        descripcion: "Alta de nuevo socio",
        fecha: s.fechaAlta.toISOString(),
      })),
    ...usuariosSocio
      .filter((u) => u.deletedAt !== null && u.deletedAt >= hace24h)
      .map((u) => ({
        tipo: "BAJA_SOCIO" as const,
        nombre: u.nombre,
        descripcion: "Baja de socio",
        fecha: (u.deletedAt as Date).toISOString(),
      })),
    ...asignaciones.map((a) => ({
      tipo: "ASIGNACION_RUTINA" as const,
      nombre: nombreDeSocio(a.socioId) ?? "Socio",
      descripcion: `Rutina asignada: ${rutinaPorId.get(a.rutinaId) ?? "rutina"}`,
      fecha: a.fechaAsignacion.toISOString(),
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, MAX_EVENTOS);

  return {
    ahora: now.toISOString(),
    config: {
      capacidadMaxima: config?.capacidadMaxima ?? null,
      periodoGracia: config?.periodoGracia ?? null,
      diasInactividad: config?.diasInactividad ?? null,
    },
    maquinas: maquinas.map((m) => ({ estado: m.estado })),
    pagos: pagosRecientes
      .filter((p) => p.estado === "CONFIRMADO")
      .map((p) => ({
        monto: Number(p.monto),
        metodoPago: p.metodoPago,
        estado: p.estado,
        fecha: p.fechaPago.toISOString(),
      })),
    cuotas: padron.flatMap((s) => {
      const vencimiento = cuotaPorSocio.get(s.id);
      return vencimiento
        ? [{ socioId: s.id, socioNombre: usuarioPorId.get(s.usuarioId)?.nombre ?? "Socio", fechaVencimiento: vencimiento.toISOString() }]
        : [];
    }),
    ultimasAsistencias: padron.map((s) => visitaPorSocio.get(s.id)?.toISOString() ?? null),
    aforo: {
      asistenciasActivas: asistencias.filter((a) => a.fechaHora >= desdeVentana).length,
      horas,
      horaActual,
    },
    personal: personal
      .map((e) => e.rol as string)
      .filter((rol): rol is StaffRol => STAFF.includes(rol))
      .map((rol) => ({ rol })),
    contadores: { rutinas, ejercicios, clientes, membresias: planes.length },
    eventos,
  };
}
