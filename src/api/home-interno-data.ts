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
 */
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_VENTANA_AFORO_MIN = 90;
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

  const config = await prisma.configuracionDelSistema.findFirst({ orderBy: { updatedAt: "desc" } });
  const ventanaMin = config?.ventanaAforoMinutos ?? DEFAULT_VENTANA_AFORO_MIN;
  const desdeVentana = new Date(now.getTime() - ventanaMin * 60 * 1000);

  const [
    maquinas, pagos, socios, asistencias, empleados,
    rutinas, ejercicios, clientes, membresias,
    pagosEvt, altas, bajas, asignaciones,
  ] = await Promise.all([
    prisma.maquina.findMany({ select: { estado: true } }),
    prisma.pago.findMany({
      where: { estado: "CONFIRMADO", fechaPago: { gte: hace36h } },
      select: { monto: true, metodoPago: true, estado: true, fechaPago: true },
    }),
    // One pass over the active roster feeds both "cuotas por vencer" and "socios inactivos".
    prisma.socio.findMany({
      where: { usuario: { estado: "ACTIVO", deletedAt: null } },
      select: {
        id: true,
        usuario: { select: { nombre: true } },
        cuotas: { orderBy: { fechaVencimiento: "desc" }, take: 1, select: { fechaVencimiento: true } },
        asistencias: { where: { estado: "PERMITIDO" }, orderBy: { fechaHora: "desc" }, take: 1, select: { fechaHora: true } },
      },
    }),
    prisma.asistencia.findMany({
      where: { estado: "PERMITIDO", fechaHora: { gte: new Date(Math.min(inicioDia.getTime(), desdeVentana.getTime())) } },
      select: { fechaHora: true },
    }),
    prisma.empleado.findMany({
      where: { estadoLaboral: "ACTIVO", turno: turnoActual(now), usuario: { estado: "ACTIVO", deletedAt: null } },
      select: { usuario: { select: { rol: true } } },
    }),
    prisma.rutina.count(),
    prisma.ejercicio.count(),
    prisma.socio.count({ where: { usuario: { deletedAt: null } } }),
    prisma.membresia.count(),
    prisma.pago.findMany({
      where: { estado: { in: ["CONFIRMADO", "ANULADO"] }, fechaPago: { gte: hace24h } },
      orderBy: { fechaPago: "desc" },
      take: MAX_EVENTOS,
      select: {
        estado: true,
        fechaPago: true,
        socio: { select: { usuario: { select: { nombre: true } }, membresiaAsignada: { select: { nombre: true } } } },
      },
    }),
    prisma.socio.findMany({
      where: { fechaAlta: { gte: hace24h } },
      orderBy: { fechaAlta: "desc" },
      take: MAX_EVENTOS,
      select: { fechaAlta: true, usuario: { select: { nombre: true } } },
    }),
    prisma.usuario.findMany({
      where: { rol: "SOCIO", deletedAt: { gte: hace24h } },
      orderBy: { deletedAt: "desc" },
      take: MAX_EVENTOS,
      select: { nombre: true, deletedAt: true },
    }),
    prisma.rutinaAsignada.findMany({
      where: { fechaAsignacion: { gte: hace24h } },
      orderBy: { fechaAsignacion: "desc" },
      take: MAX_EVENTOS,
      select: {
        fechaAsignacion: true,
        rutina: { select: { nombre: true } },
        socio: { select: { usuario: { select: { nombre: true } } } },
      },
    }),
  ]);

  const entradasDeHoy = asistencias.map((a) => a.fechaHora).filter((f) => f >= inicioDia);
  const { horas, horaActual } = buildAforoHoras(entradasDeHoy, now);

  const eventos: HomeInternoDTO["eventos"] = [
    ...pagosEvt.map((p) => {
      const anulado = p.estado === "ANULADO";
      const plan = p.socio?.membresiaAsignada?.nombre;
      return {
        tipo: anulado ? ("ANULACION_PAGO" as const) : ("PAGO" as const),
        nombre: p.socio?.usuario.nombre ?? "Pago sin socio",
        descripcion: anulado ? "Pago anulado" : plan ? `Pago de membresía ${plan}` : "Pago registrado",
        fecha: p.fechaPago.toISOString(),
      };
    }),
    ...altas.map((s) => ({ tipo: "ALTA_SOCIO" as const, nombre: s.usuario.nombre, descripcion: "Alta de nuevo socio", fecha: s.fechaAlta.toISOString() })),
    ...bajas.map((u) => ({ tipo: "BAJA_SOCIO" as const, nombre: u.nombre, descripcion: "Baja de socio", fecha: (u.deletedAt as Date).toISOString() })),
    ...asignaciones.map((a) => ({
      tipo: "ASIGNACION_RUTINA" as const,
      nombre: a.socio.usuario.nombre,
      descripcion: `Rutina asignada: ${a.rutina.nombre}`,
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
    pagos: pagos.map((p) => ({
      monto: Number(p.monto),
      metodoPago: p.metodoPago,
      estado: p.estado,
      fecha: p.fechaPago.toISOString(),
    })),
    cuotas: socios.flatMap((s) =>
      s.cuotas[0]
        ? [{ socioId: s.id, socioNombre: s.usuario.nombre, fechaVencimiento: s.cuotas[0].fechaVencimiento.toISOString() }]
        : []
    ),
    ultimasAsistencias: socios.map((s) => s.asistencias[0]?.fechaHora.toISOString() ?? null),
    aforo: {
      asistenciasActivas: asistencias.filter((a) => a.fechaHora >= desdeVentana).length,
      horas,
      horaActual,
    },
    personal: empleados
      .map((e) => e.usuario.rol as string)
      .filter((rol): rol is StaffRol => STAFF.includes(rol))
      .map((rol) => ({ rol })),
    contadores: { rutinas, ejercicios, clientes, membresias },
    eventos,
  };
}
