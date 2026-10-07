import { prisma } from "@/lib/db";
import { startOfGymDay, toGymWallClock } from "@/lib/gym-time";
import { buildAforoHoras } from "@/api/home-interno-data";
import type { HomeSocioViewModel } from "@/api/home-socio";
import {
  DEFAULT_INCREMENTO_KG,
  buildSemanaCalendario,
  compute28DiasAsistencia,
  computeProgresoActual,
  computeRachaSemanas,
  selectRutinaActiva,
} from "@/domains/home-socio/home-socio";

/**
 * Server-side: arma el payload de GET /api/home-socio (contrato en src/api/home-socio.ts)
 * para UN socio. Nunca importar desde código de cliente: arrastra Prisma.
 * Spec: openspec/specs/home-socio-portal/spec.md
 *
 * Solo junta hechos crudos; las reglas viven en src/domains/home-socio y se prueban allá.
 *
 * Supuestos que la spec no define (cambiarlos acá):
 * - Aforo: idéntico a Home_Interno (AC-005): mismas asistencias PERMITIDO, misma ventana
 *   `ventanaAforoMinutos` (90 por defecto) y mismas barras de 2 h (buildAforoHoras).
 * - Racha: se miran hasta 53 semanas de asistencias PERMITIDO del socio (tope de la racha).
 * - Sesión en progreso: SesionDeEntrenamiento sin `horaFin` iniciada hoy (hora del gimnasio).
 * - indiceActual = 0: no se guarda en qué ejercicio va la sesión (no hay API de sesiones aún).
 * - Máquinas (RN-05, footer de Tarjeta_Detalle): Ejercicio no tiene relación con Maquina en el
 *   schema, así que el payload no trae estado de máquina.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VENTANA_AFORO_MIN = 90;
const VENTANA_PROGRESO_DIAS = 28;
const MAX_SEMANAS_RACHA = 53;

export async function buildHomeSocioPayload(
  usuarioId: string,
  now: Date = new Date()
): Promise<HomeSocioViewModel | null> {
  const socio = await prisma.socio.findUnique({
    where: { usuarioId },
    select: {
      id: true,
      membresiaAsignada: { select: { nombre: true, periodicidad: true } },
      cuotas: { orderBy: { fechaVencimiento: "desc" }, take: 1, select: { fechaVencimiento: true } },
    },
  });
  if (!socio) return null;

  const inicioDia = startOfGymDay(now);
  const config = await prisma.configuracionDelSistema.findFirst({ orderBy: { updatedAt: "desc" } });
  const ventanaMin = config?.ventanaAforoMinutos ?? DEFAULT_VENTANA_AFORO_MIN;
  const desdeVentana = new Date(now.getTime() - ventanaMin * 60 * 1000);

  const [asistenciasGym, asistenciasSocio, registros, regla, asignaciones, sesion] = await Promise.all([
    prisma.asistencia.findMany({
      where: { estado: "PERMITIDO", fechaHora: { gte: new Date(Math.min(inicioDia.getTime(), desdeVentana.getTime())) } },
      select: { fechaHora: true },
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
    prisma.registroDeProgreso.findMany({
      where: { socioId: socio.id, fecha: { gte: new Date(now.getTime() - VENTANA_PROGRESO_DIAS * DAY_MS) } },
      orderBy: { fecha: "desc" },
      select: { carga: true, fecha: true, ejercicio: { select: { id: true, nombre: true } } },
    }),
    prisma.reglaDeProgresion.findFirst({ where: { tipo: "LINEAL" }, select: { incrementoSugerido: true } }),
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
                ejercicio: { select: { id: true, nombre: true, grupoMuscular: true, descripcion: true } },
              },
            },
          },
        },
      },
    }),
    prisma.sesionDeEntrenamiento.findFirst({
      where: { socioId: socio.id, horaFin: null, horaInicio: { gte: inicioDia } },
      select: { id: true },
    }),
  ]);

  // Aforo (AC-005): mismo cálculo que Home_Interno.
  const entradasDeHoy = asistenciasGym.map((a) => a.fechaHora).filter((f) => f >= inicioDia);
  const { horas, horaActual } = buildAforoHoras(entradasDeHoy, now);

  // Las funciones de dominio usan getUTC*: se les pasan fechas en hora de pared del gimnasio.
  const hoy = toGymWallClock(now);
  const fechas = asistenciasSocio.map((a) => toGymWallClock(a.fechaHora));

  // RN-04 / AC-002
  const { rutinaAsignada, isAnomaly } = selectRutinaActiva(
    asignaciones.map((a) => ({ id: a.id, fechaAsignacion: a.fechaAsignacion, rutinaId: a.rutinaId }))
  );
  if (isAnomaly) {
    console.warn("ROUTINE_INTEGRITY_ERROR: más de una rutina activa", { socioId: socio.id, asignaciones: asignaciones.length });
  }
  const rutina = asignaciones.find((a) => a.id === rutinaAsignada?.id)?.rutina ?? null;

  const cuota = socio.cuotas[0];
  const dias28 = compute28DiasAsistencia(fechas, hoy);

  return {
    progreso: computeProgresoActual(
      registros.map((r) => ({
        ejercicioId: r.ejercicio.id,
        ejercicioNombre: r.ejercicio.nombre,
        carga: Number(r.carga),
        fecha: r.fecha,
      })),
      now,
      regla ? Number(regla.incrementoSugerido) : DEFAULT_INCREMENTO_KG
    ),
    aforo: {
      ocupacionActual: asistenciasGym.filter((a) => a.fechaHora >= desdeVentana).length,
      capacidadMaxima: config?.capacidadMaxima ?? 0,
      horas,
      horaActual,
    },
    rutinaActiva: rutina
      ? {
          nombre: rutina.nombre,
          indiceActual: 0,
          ejercicios: rutina.ejercicios.map((e) => ({
            id: e.ejercicio.id,
            nombre: e.ejercicio.nombre,
            grupoMuscular: e.ejercicio.grupoMuscular,
            descripcion: e.ejercicio.descripcion,
            series: e.series,
            repeticiones: e.repeticiones,
            descanso: e.descanso,
          })),
        }
      : null,
    sesionEnProgreso: sesion !== null,
    racha: {
      semanasRacha: computeRachaSemanas(fechas, hoy),
      dias: buildSemanaCalendario(fechas, hoy),
    },
    membresia:
      socio.membresiaAsignada && cuota
        ? {
            planNombre: socio.membresiaAsignada.nombre,
            fechaVencimiento: cuota.fechaVencimiento.toISOString(),
            diasTotalMembresia: Math.max(1, socio.membresiaAsignada.periodicidad),
            dias28: dias28.dias,
            totalAsistencias28Dias: dias28.total,
          }
        : null,
  };
}
