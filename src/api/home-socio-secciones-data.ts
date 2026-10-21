import { prisma } from "@/lib/db";
import { toGymWallClock } from "@/lib/gym-time";
import { getConfiguracion } from "@/lib/configuracion";
import { selectRutinaActiva } from "@/domains/home-socio/home-socio";
import { SOLO_SERIES_DE_TRABAJO } from "@/domains/sesion/tipo-serie";
import {
  buildCalendarioAsistencias,
  computeProgresoPorEjercicio,
  computeRachaDeAsistencias,
  resumirMembresia,
  resumirSesiones,
} from "@/domains/home-socio/secciones";
import type { HomeSocioSeccionesViewModel } from "@/api/home-socio-secciones";

/**
 * Server-side: arma el payload de GET /api/home-socio/secciones (contrato en
 * src/api/home-socio-secciones.ts) para UN socio. Nunca importar desde código de cliente:
 * arrastra Prisma.
 *
 * Identidad: recibe el `Usuario.id` de la sesión (cookie/Bearer); resuelve el `Socio` y
 * filtra TODAS las consultas por su `socioId`. Un socio nunca ve datos de otro.
 *
 * Supuestos que la spec no define:
 * - Historial de sesiones: las últimas 20.
 * - Historial de pagos: los últimos 24.
 * - Calendario de asistencias: 35 días del gimnasio (5 semanas) terminando hoy.
 * - Racha: hasta 53 semanas de asistencias PERMITIDO (mismo tope que Home_Socio).
 * - Progreso: ventana de 84 días (12 semanas), un punto por día con la mayor carga. La ventana
 *   se filtra en la base (NEW-8); la mejor marca sale de un agregado all-time (`groupBy`).
 * - Día límite de pago y gracia salen de ConfiguracionDelSistema (D-40).
 */
const MAX_SEMANAS_RACHA = 53;
const DIAS_CALENDARIO_ASISTENCIAS = 35;
const VENTANA_PROGRESO_DIAS = 84;
const MAX_SESIONES = 20;
const MAX_PAGOS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildHomeSocioSeccionesPayload(
  usuarioId: string,
  now: Date = new Date()
): Promise<HomeSocioSeccionesViewModel | null> {
  const socio = await prisma.socio.findUnique({
    where: { usuarioId },
    select: {
      id: true,
      membresiaAsignada: { select: { nombre: true } },
    },
  });
  if (!socio) return null;

  const { diaLimitePago: diaLimite, periodoGracia: gracia } = await getConfiguracion(prisma);

  const [asignaciones, sesiones, sesionEnCurso, registros, mejoresFilas, pagos, ultimaCuota, asistencias] =
    await Promise.all([
      prisma.rutinaAsignada.findMany({
        where: { socioId: socio.id, activa: true },
        orderBy: { fechaAsignacion: "asc" },
        select: {
          id: true,
          fechaAsignacion: true,
          rutinaId: true,
          rutina: {
            select: {
              nombre: true,
              ejercicios: {
                orderBy: { orden: "asc" },
                select: {
                  series: true,
                  repeticiones: true,
                  descanso: true,
                  ejercicio: {
                    select: {
                      id: true, nombre: true, grupoMuscular: true, descripcion: true,
                      // Catálogo (D-70): son pocos ejercicios por rutina, así que las instrucciones viajan completas.
                      mediaId: true, equipamiento: true, musculoObjetivo: true, instrucciones: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.sesionDeEntrenamiento.findMany({
        where: { socioId: socio.id },
        orderBy: { horaInicio: "desc" },
        take: MAX_SESIONES,
        select: { id: true, horaInicio: true, horaFin: true, estadoDeFinalizacion: true },
      }),
      prisma.sesionDeEntrenamiento.findFirst({
        where: { socioId: socio.id, estadoDeFinalizacion: "EN_CURSO" },
        orderBy: { horaInicio: "desc" },
        select: { id: true, horaInicio: true, ejercicioActualId: true, serieActual: true },
      }),
      // NEW-8: el progreso se acota en la base a la ventana; el resto del historial no se trae.
      prisma.registroDeProgreso.findMany({
        where: {
          socioId: socio.id,
          fecha: { gte: new Date(now.getTime() - VENTANA_PROGRESO_DIAS * DAY_MS) },
          // D-64: el progreso se mide con series de trabajo; el calentamiento no cuenta.
          ...SOLO_SERIES_DE_TRABAJO,
        },
        orderBy: { fecha: "asc" },
        select: {
          carga: true,
          repeticiones: true,
          fecha: true,
          ejercicio: { select: { id: true, nombre: true } },
        },
      }),
      // NEW-8: la mejor marca sí mira TODO el historial, pero como agregado en la base:
      // una fila por ejercicio en vez de todo el historial.
      prisma.registroDeProgreso.groupBy({
        by: ["ejercicioId"],
        where: { socioId: socio.id, ...SOLO_SERIES_DE_TRABAJO },
        _max: { carga: true },
      }),
      prisma.pago.findMany({
        where: { socioId: socio.id },
        orderBy: { fechaPago: "desc" },
        take: MAX_PAGOS,
        select: {
          id: true,
          fechaPago: true,
          monto: true,
          metodoPago: true,
          cuota: { select: { fechaVencimiento: true } },
        },
      }),
      prisma.cuota.findFirst({
        where: { socioId: socio.id },
        orderBy: { fechaVencimiento: "desc" },
        select: { fechaVencimiento: true },
      }),
      prisma.asistencia.findMany({
        where: {
          socioId: socio.id,
          estado: "PERMITIDO",
          fechaHora: { gte: new Date(now.getTime() - MAX_SEMANAS_RACHA * 7 * DAY_MS) },
        },
        orderBy: { fechaHora: "desc" },
        select: { fechaHora: true },
      }),
    ]);

  // RN-04 / AC-002: una sola rutina activa; si hay más, se usa la más antigua y se avisa.
  const { rutinaAsignada, isAnomaly } = selectRutinaActiva(
    asignaciones.map((a) => ({ id: a.id, fechaAsignacion: a.fechaAsignacion, rutinaId: a.rutinaId }))
  );
  if (isAnomaly) {
    console.warn("ROUTINE_INTEGRITY_ERROR: más de una rutina activa", {
      socioId: socio.id,
      asignaciones: asignaciones.length,
    });
  }
  const rutina = asignaciones.find((a) => a.id === rutinaAsignada?.id)?.rutina ?? null;

  const registrosRef = registros.map((r) => ({
    ejercicioId: r.ejercicio.id,
    ejercicioNombre: r.ejercicio.nombre,
    carga: Number(r.carga),
    repeticiones: r.repeticiones,
    fecha: r.fecha,
  }));
  // Mismo resultado que `computeMejoresMarcas` (máximo por ejercicio), pero calculado en la base.
  const mejores = new Map<string, number>();
  for (const fila of mejoresFilas) {
    if (fila._max.carga !== null) mejores.set(fila.ejercicioId, Number(fila._max.carga));
  }

  const ejercicios = (rutina?.ejercicios ?? []).map((e) => ({
    id: e.ejercicio.id,
    nombre: e.ejercicio.nombre,
    grupoMuscular: e.ejercicio.grupoMuscular,
    descripcion: e.ejercicio.descripcion,
    series: e.series,
    repeticiones: e.repeticiones,
    descanso: e.descanso,
    mejorMarca: mejores.get(e.ejercicio.id) ?? null,
    mediaId: e.ejercicio.mediaId ?? null,
    equipamiento: e.ejercicio.equipamiento ?? null,
    musculoObjetivo: e.ejercicio.musculoObjetivo ?? null,
    instrucciones: e.ejercicio.instrucciones ?? [],
  }));

  // Fechas en hora de pared del gimnasio para las funciones puras (usan getUTC*).
  const hoy = toGymWallClock(now);
  const fechasAsistencia = asistencias.map((a) => toGymWallClock(a.fechaHora));
  const calendario = buildCalendarioAsistencias(fechasAsistencia, hoy, DIAS_CALENDARIO_ASISTENCIAS);

  const hayMembresia = socio.membresiaAsignada !== null || pagos.length > 0;
  const membresia = hayMembresia
    ? {
        planNombre: socio.membresiaAsignada?.nombre ?? null,
        ...resumirMembresia({
          pagos: pagos.map((p) => ({
            id: p.id,
            fechaPago: p.fechaPago,
            monto: Number(p.monto),
            metodoPago: p.metodoPago,
            cuota: p.cuota ? { fechaVencimiento: p.cuota.fechaVencimiento } : null,
          })),
          ultimaCuota: ultimaCuota ? { fechaVencimiento: ultimaCuota.fechaVencimiento } : null,
          hoy: now,
          diaLimite,
          gracia,
        }),
      }
    : null;

  return {
    rutina: rutina
      ? {
          nombre: rutina.nombre,
          rutinaAsignadaId: rutinaAsignada?.id ?? "",
          ejercicios,
        }
      : null,
    sesiones: resumirSesiones(
      sesiones.map((s) => ({
        id: s.id,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        estado: s.estadoDeFinalizacion,
      }))
    ),
    sesionEnCurso: sesionEnCurso
      ? {
          id: sesionEnCurso.id,
          horaInicio: sesionEnCurso.horaInicio.toISOString(),
          ejercicioActualId: sesionEnCurso.ejercicioActualId,
          serieActual: sesionEnCurso.serieActual,
        }
      : null,
    ejercicios,
    progreso: computeProgresoPorEjercicio(registrosRef, now, VENTANA_PROGRESO_DIAS),
    membresia,
    asistencias: {
      rachaSemanas: computeRachaDeAsistencias(fechasAsistencia, hoy),
      total: calendario.total,
      dias: calendario.dias,
    },
  };
}
