import { prisma } from "@/lib/db";
import { getConfiguracion } from "@/lib/configuracion";
import { startOfGymDay, toGymWallClock } from "@/lib/gym-time";
import { buildAforoHoras } from "@/api/home-interno-data";
import type { HomeSocioViewModel } from "@/api/home-socio";
import { estadoCuotaSocio, periodoDe } from "@/domains/pago/cuota";
import { evaluarOfertaDeSocio } from "@/domains/pago/oferta-reactivacion-consulta";
import type { ConfigOferta } from "@/domains/pago/oferta-reactivacion";
import { seguimientoDeEjercicios } from "@/domains/sesion/sesion-de-entrenamiento";
import { SOLO_SERIES_DE_TRABAJO } from "@/domains/sesion/tipo-serie";
import {
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
 * - Sesión en progreso: SesionDeEntrenamiento en `EN_CURSO` (mismo criterio que la pantalla
 *   de ejecución, GET /api/sesiones?enCurso=1). El `indiceActual` se deriva del
 *   `ejercicioActualId` para retomar el ejercicio correcto tras una recarga (SE-4).
 * - Máquinas (RN-05, footer de Tarjeta_Detalle): Ejercicio no tiene relación con Maquina en el
 *   schema, así que el payload no trae estado de máquina.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const VENTANA_PROGRESO_DIAS = 28;
const MAX_SEMANAS_RACHA = 53;
/** Pesajes que se leen para el gráfico: de sobra para los 120 puntos (uno por día) que se dibujan. */
const MAX_SESIONES_HISTORIAL = 5;
const MAX_PESAJES = 400;

export async function buildHomeSocioPayload(
  usuarioId: string,
  now: Date = new Date()
): Promise<HomeSocioViewModel | null> {
  const socio = await prisma.socio.findUnique({
    where: { usuarioId },
    select: {
      id: true,
      estadoCuota: true,
      fechaAlta: true,
      pesoObjetivo: true,
      pesoInicialDeMeta: true,
      membresiaAsignada: { select: { nombre: true, periodicidad: true } },
      cuotas: { orderBy: { fechaVencimiento: "desc" }, take: 1, select: { fechaVencimiento: true } },
    },
  });
  if (!socio) return null;

  const inicioDia = startOfGymDay(now);
  const config = await getConfiguracion(prisma);
  const ventanaMin = config.ventanaAforoMinutos;
  const desdeVentana = new Date(now.getTime() - ventanaMin * 60 * 1000);

  // Oferta de reactivación (D-54): es un solo socio, así que se reusan los datos ya cargados
  // (cuota, membresía, config) y `evaluarOfertaDeSocio` agrega solo lo que le falta (última
  // asistencia y último pago con descuento). Con la oferta apagada no consulta nada.
  const ultimaCuota = socio.cuotas[0];
  const estadoPago = estadoCuotaSocio({
    ultimoPeriodoCubierto: ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null,
    hoy: now,
    diaLimite: config.diaLimitePago,
    gracia: config.periodoGracia,
  });
  const configOferta: ConfigOferta = {
    ofertaReactivacionActiva: config.ofertaReactivacionActiva,
    diasSinAsistirParaOferta: config.diasSinAsistirParaOferta,
    descuentoReactivacion: config.descuentoReactivacion,
    enfriamientoOfertaDias: config.enfriamientoOfertaDias,
  };

  const [asistenciasGym, asistenciasSocio, registros, asignaciones, sesion, evaluacionOferta, sesionesCerradas, pesajes] = await Promise.all([
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
      // D-64: el progreso se mide con series de trabajo; el calentamiento no cuenta.
      where: {
        socioId: socio.id,
        fecha: { gte: new Date(now.getTime() - VENTANA_PROGRESO_DIAS * DAY_MS) },
        ...SOLO_SERIES_DE_TRABAJO,
      },
      orderBy: { fecha: "desc" },
      select: { carga: true, fecha: true, ejercicio: { select: { id: true, nombre: true } } },
    }),
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
                // D-59: el motor ignora las sesiones anteriores al último cambio del ejercicio en la rutina.
                updatedAt: true,
                ejercicio: { select: { id: true, nombre: true, grupoMuscular: true, descripcion: true, mediaId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.sesionDeEntrenamiento.findFirst({
      where: { socioId: socio.id, estadoDeFinalizacion: "EN_CURSO" },
      orderBy: { horaInicio: "desc" },
      select: { id: true, ejercicioActualId: true },
    }),
    evaluarOfertaDeSocio(
      prisma,
      socio.id,
      configOferta,
      {
        estadoCuenta: socio.estadoCuota,
        tieneMembresia: socio.membresiaAsignada !== null,
        estadoPago,
        fechaAlta: socio.fechaAlta,
      },
      now,
    ),
    // Historial del inicio: las últimas sesiones cerradas con sus series de trabajo. Es el único
    // lugar donde se calcula volumen y duración para el socio; no se guarda denormalizado.
    prisma.sesionDeEntrenamiento.findMany({
      where: {
        socioId: socio.id,
        estadoDeFinalizacion: { in: ["COMPLETADA", "INCOMPLETA"] },
        // Una sesión abierta y cerrada sin registrar series no es historial: no ensucia la tabla.
        registrosProgreso: { some: { tipo: { not: "CALENTAMIENTO" } } },
      },
      orderBy: { horaInicio: "desc" },
      take: MAX_SESIONES_HISTORIAL,
      select: {
        id: true,
        horaInicio: true,
        horaFin: true,
        rutinaAsignada: { select: { rutina: { select: { nombre: true } } } },
        registrosProgreso: {
          where: SOLO_SERIES_DE_TRABAJO,
          select: { carga: true, repeticiones: true },
        },
      },
    }),
    // T-048: los pesajes del propio socio, los más recientes primero (se entregan del más antiguo al más reciente).
    prisma.medicionDePeso.findMany({
      where: { socioId: socio.id },
      orderBy: { fecha: "desc" },
      take: MAX_PESAJES,
      select: { id: true, peso: true, fecha: true },
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

  // SE-4: si hay sesión EN_CURSO, retomamos en el ejercicio actual (por `ejercicioActualId`).
  const ejerciciosDeRutina = rutina?.ejercicios ?? [];
  const idxSesion = sesion?.ejercicioActualId
    ? ejerciciosDeRutina.findIndex((e) => e.ejercicio.id === sesion.ejercicioActualId)
    : -1;
  const indiceActual = idxSesion >= 0 ? idxSesion : 0;

  // Historial del inicio. D-64: el volumen sólo cuenta series de trabajo (la consulta ya filtra
  // CALENTAMIENTO). Si la sesión quedó sin `horaFin`, la duración se mide contra el inicio (0 min).
  const ultimasSesiones = sesionesCerradas.map((s) => {
    const fin = s.horaFin ?? s.horaInicio;
    const volumen = s.registrosProgreso.reduce((total, r) => total + Number(r.carga) * r.repeticiones, 0);
    return {
      id: s.id,
      fecha: s.horaInicio.toISOString(),
      rutinaNombre: s.rutinaAsignada.rutina.nombre,
      series: s.registrosProgreso.length,
      volumenKg: Math.round(volumen),
      duracionMin: Math.max(0, Math.round((fin.getTime() - s.horaInicio.getTime()) / 60000)),
    };
  });

  // P-42 (D-60): la tarjeta de progreso muestra la sugerencia del motor, no "marca + incremento".
  const progresoActual = computeProgresoActual(
    registros.map((r) => ({
      ejercicioId: r.ejercicio.id,
      ejercicioNombre: r.ejercicio.nombre,
      carga: Number(r.carga),
      fecha: r.fecha,
    })),
    now
  );
  const progreso = progresoActual
    ? {
        ejercicioNombre: progresoActual.ejercicioNombre,
        marcaActual: progresoActual.marcaActual,
        deltaEsteMes: progresoActual.deltaEsteMes,
        progresionCarga: progresoActual.progresionCarga,
        sugerencia: await sugerenciaDelMotor({
          socioId: socio.id,
          ejercicioId: progresoActual.ejercicioId,
          ejerciciosDeRutina,
          sesionActualId: sesion?.id ?? null,
        }),
      }
    : null;

  return {
    progreso,
    aforo: {
      ocupacionActual: asistenciasGym.filter((a) => a.fechaHora >= desdeVentana).length,
      capacidadMaxima: config.capacidadMaxima,
      horas,
      horaActual,
    },
    rutinaActiva: rutina
      ? {
          nombre: rutina.nombre,
          rutinaAsignadaId: rutinaAsignada?.id ?? "",
          indiceActual,
          ejercicios: ejerciciosDeRutina.map((e) => ({
            id: e.ejercicio.id,
            nombre: e.ejercicio.nombre,
            mediaId: e.ejercicio.mediaId,
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
    oferta: evaluacionOferta.elegible ? { descuentoPct: evaluacionOferta.descuentoPct } : null,
    ultimasSesiones,
    peso: {
      // P-47 (D-68): los pesajes con su id, del más antiguo al más reciente. La tarjeta decide
      // cuáles dibujar (uno por día, el último) y cuáles listar para borrar (los 3 últimos).
      mediciones: [...pesajes].reverse().map((m) => ({
        id: m.id,
        fecha: m.fecha.toISOString(),
        peso: Number(m.peso),
      })),
      pesoObjetivo: socio.pesoObjetivo === null || socio.pesoObjetivo === undefined ? null : Number(socio.pesoObjetivo),
      pesoInicial:
        socio.pesoInicialDeMeta === null || socio.pesoInicialDeMeta === undefined ? null : Number(socio.pesoInicialDeMeta),
    },
  };
}

/**
 * Sugerencia del motor de progresión para el ejercicio que muestra la tarjeta de progreso del
 * Home (P-42, D-60). Usa `seguimientoDeEjercicios`, la misma función que alimenta la pantalla de
 * entrenamiento, así los dos lugares siempre dicen lo mismo.
 *
 * Devuelve `null` si el ejercicio ya no está en la rutina activa: el motor juzga las sesiones
 * contra lo que la rutina pide (series y repeticiones) y sin rutina no hay contra qué.
 * La sesión en curso no cuenta como historial: una serie floja de hoy no cambia la sugerencia.
 */
async function sugerenciaDelMotor(input: {
  socioId: string;
  ejercicioId: string;
  ejerciciosDeRutina: Array<{
    series: number;
    repeticiones: number;
    updatedAt: Date;
    ejercicio: { id: string };
  }>;
  sesionActualId: string | null;
}) {
  const enRutina = input.ejerciciosDeRutina.find((e) => e.ejercicio.id === input.ejercicioId);
  if (!enRutina) return null;

  const { sugerencias } = await seguimientoDeEjercicios({
    socioId: input.socioId,
    ejercicios: [
      {
        ejercicioId: input.ejercicioId,
        series: enRutina.series,
        repeticiones: enRutina.repeticiones,
        updatedAt: enRutina.updatedAt,
      },
    ],
    sesionActualId: input.sesionActualId,
  });
  return sugerencias[input.ejercicioId] ?? null;
}
