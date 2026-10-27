import type { EntradaMotor } from "./motor-espera";
import type { AsignacionDb, LecturaEntrada } from "./asignacion-puerto";
import { SERIES_DE_TRABAJO, anomalia } from "./asignacion-puerto";

interface FilaSesionOcupante {
  id: string;
  socioId: string;
  ejercicioActualId: string | null;
  horaInicio: Date;
  rutinaAsignada: {
    rutina: {
      ejercicios: Array<{ ejercicioId: string; series: number; descanso: number }>;
    };
  };
}

interface FilaEjecucionEnCurso {
  id: string;
  socioId: string;
  sesionId: string | null;
  ejercicioId: string;
  maquinaId: string | null;
  creadaEn: Date;
}

interface FilaActividad {
  sesionId: string | null;
  fecha: Date;
}

interface FilaSerieDeTrabajo {
  sesionId: string | null;
  ejercicioId: string;
  numeroSerie: number;
}


/** Cuenta solo las series dentro de `1..seriePrescripta` (D-87, design §6 paso 4). */
export function contarSeriesValidas(numeroSeries: number[], seriePrescripta: number): number {
  return new Set(
    numeroSeries.filter((numero) => numero >= 1 && numero <= seriePrescripta)
  ).size;
}

/**
 * Candidatas del ejercicio que hace el ocupante, leídas de `EjercicioMaquina`. No se usan los
 * pendientes del consultante: el ejercicio del ocupante normalmente NO está entre ellos.
 */
async function leerCandidatosDeOcupantes(
  sesiones: FilaSesionOcupante[],
  filaPorSesion: Map<string, FilaEjecucionEnCurso>,
  db: AsignacionDb
): Promise<Map<string, string[]>> {
  const sinFila = Array.from(
    new Set(
      sesiones
        .filter((sesion) => {
          const fila = filaPorSesion.get(sesion.id);
          return !fila || fila.ejercicioId !== sesion.ejercicioActualId;
        })
        .map((sesion) => sesion.ejercicioActualId)
        .filter((id): id is string => id !== null)
    )
  );

  const porEjercicio = new Map<string, string[]>();
  if (sinFila.length === 0) return porEjercicio;

  const filas = (await db.ejercicioMaquina.findMany({
    where: { ejercicioId: { in: sinFila } },
    orderBy: [{ ejercicioId: "asc" }, { maquinaId: "asc" }],
    select: { ejercicioId: true, maquinaId: true },
  })) as Array<{ ejercicioId: string; maquinaId: string }>;

  for (const fila of filas) {
    const lista = porEjercicio.get(fila.ejercicioId) ?? [];
    lista.push(fila.maquinaId);
    porEjercicio.set(fila.ejercicioId, lista);
  }
  for (const lista of porEjercicio.values()) lista.sort();
  return porEjercicio;
}

export async function aplicarOcupantes(
  maquinas: EntradaMotor["maquinas"],
  lectura: LecturaEntrada,
  db: AsignacionDb
): Promise<void> {
    if (maquinas.length === 0) return;

    const sesiones = (await db.sesionDeEntrenamiento.findMany({
      where: {
        estadoDeFinalizacion: "EN_CURSO",
        socioId: { not: lectura.socioId },
        ejercicioActualId: { not: null },
      },
      select: {
        id: true,
        socioId: true,
        ejercicioActualId: true,
        horaInicio: true,
        rutinaAsignada: {
          select: {
            rutina: {
              select: {
                ejercicios: { select: { ejercicioId: true, series: true, descanso: true } },
              },
            },
          },
        },
      },
    })) as FilaSesionOcupante[];

    const ejecuciones = (await db.asignacionDeEjercicio.findMany({
      where: {
        estado: "EN_CURSO",
        socioId: { not: lectura.socioId },
        maquinaId: { not: null },
      },
      orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
      select: {
        id: true,
        socioId: true,
        sesionId: true,
        ejercicioId: true,
        maquinaId: true,
        creadaEn: true,
      },
    })) as FilaEjecucionEnCurso[];

    if (sesiones.length === 0 && ejecuciones.length === 0) return;

    const idsDeSesiones = Array.from(
      new Set(
        [
          ...sesiones.map((sesion) => sesion.id),
          ...ejecuciones.map((fila) => fila.sesionId).filter((id): id is string => id !== null),
        ]
      )
    );

    const actividad = idsDeSesiones.length
      ? ((await db.registroDeProgreso.findMany({
          where: { sesionId: { in: idsDeSesiones } },
          select: { sesionId: true, fecha: true },
        })) as FilaActividad[])
      : [];
    const ultimaActividad = new Map<string, Date>();
    for (const fila of actividad) {
      if (!fila.sesionId) continue;
      const previa = ultimaActividad.get(fila.sesionId);
      if (!previa || fila.fecha.getTime() > previa.getTime()) {
        ultimaActividad.set(fila.sesionId, fila.fecha);
      }
    }

    const series = idsDeSesiones.length
      ? ((await db.registroDeProgreso.findMany({
          where: {
            sesionId: { in: idsDeSesiones },
            tipo: { in: [...SERIES_DE_TRABAJO] },
            numeroSerie: { not: null },
          },
          select: { sesionId: true, ejercicioId: true, numeroSerie: true },
        })) as FilaSerieDeTrabajo[])
      : [];
    const seriesPorSesionEjercicio = new Map<string, number[]>();
    for (const fila of series) {
      if (!fila.sesionId) continue;
      const clave = `${fila.sesionId}:${fila.ejercicioId}`;
      const lista = seriesPorSesionEjercicio.get(clave) ?? [];
      lista.push(fila.numeroSerie);
      seriesPorSesionEjercicio.set(clave, lista);
    }

    const corte = new Date(
      lectura.ahora.getTime() - lectura.minutosInactividadSesion * 60_000
    ).getTime();
    const vigente = (fecha: Date | undefined, respaldo: Date): boolean =>
      (fecha ?? respaldo).getTime() >= corte;

    const maquinasPorId = new Map(maquinas.map((maquina) => [maquina.id, maquina]));

    // Filas EN_CURSO: la más reciente por sesión; una anomalía si hay varias.
    const filaPorSesion = new Map<string, FilaEjecucionEnCurso>();
    for (const fila of ejecuciones) {
      if (!fila.sesionId) continue;
      if (filaPorSesion.has(fila.sesionId)) {
        anomalia("ejecuciones-multiples", { sesionId: fila.sesionId });
        continue;
      }
      filaPorSesion.set(fila.sesionId, fila);
    }

    const candidatosPorEjercicio = await leerCandidatosDeOcupantes(sesiones, filaPorSesion, db);

    for (const sesion of sesiones) {
      if (!vigente(ultimaActividad.get(sesion.id), sesion.horaInicio)) continue;
      const ejercicioId = sesion.ejercicioActualId;
      if (!ejercicioId) continue;

      const prescripcion = sesion.rutinaAsignada.rutina.ejercicios.find(
        (ejercicio) => ejercicio.ejercicioId === ejercicioId
      );
      if (!prescripcion) continue;

      const fila = filaPorSesion.get(sesion.id);
      const filaVigente = fila && fila.ejercicioId === ejercicioId ? fila : undefined;
      const candidatas = filaVigente
        ? []
        : candidatosPorEjercicio.get(ejercicioId) ?? [];
      const maquinaId =
        filaVigente?.maquinaId ?? (candidatas.length === 1 ? candidatas[0] : null);
      if (!maquinaId) continue;

      const maquina = maquinasPorId.get(maquinaId);
      if (!maquina) continue;

      const hechas = seriesPorSesionEjercicio.get(`${sesion.id}:${ejercicioId}`) ?? [];
      const restantes = prescripcion.series - contarSeriesValidas(hechas, prescripcion.series);
      if (restantes < 1) continue;

      maquina.ocupante = { seriesRestantes: restantes, descanso: prescripcion.descanso };
    }
  }

  /** Cola de terceros: RESERVADAS no vencidas, orden de creación, P-67. */

export async function aplicarCola(
    maquinas: EntradaMotor["maquinas"],
    lectura: LecturaEntrada,
    db: AsignacionDb
  ): Promise<void> {
    const ids = maquinas.map((maquina) => maquina.id);
    if (ids.length === 0) return;

    const reservas = (await db.asignacionDeEjercicio.findMany({
      where: {
        estado: "RESERVADA",
        venceEn: { gt: lectura.ahora },
        socioId: { not: lectura.socioId },
        maquinaId: { in: ids },
      },
      orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
      select: { id: true, socioId: true, ejercicioId: true, maquinaId: true, creadaEn: true },
    })) as Array<{
      id: string;
      socioId: string;
      ejercicioId: string;
      maquinaId: string | null;
      creadaEn: Date;
    }>;

    if (reservas.length === 0) return;

    const socios = Array.from(new Set(reservas.map((reserva) => reserva.socioId)));
    const rutinas = (await db.rutinaAsignada.findMany({
      where: { socioId: { in: socios }, activa: true },
      orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }],
      select: {
        socioId: true,
        rutina: {
          select: { ejercicios: { select: { ejercicioId: true, series: true, descanso: true } } },
        },
      },
    })) as Array<{
      socioId: string;
      rutina: { ejercicios: Array<{ ejercicioId: string; series: number; descanso: number }> };
    }>;

    const prescripcionPorSocio = new Map<string, Map<string, { series: number; descanso: number }>>();
    for (const rutina of rutinas) {
      if (prescripcionPorSocio.has(rutina.socioId)) continue;
      prescripcionPorSocio.set(
        rutina.socioId,
        new Map(rutina.rutina.ejercicios.map((ejercicio) => [ejercicio.ejercicioId, ejercicio]))
      );
    }

    const maquinasPorId = new Map(maquinas.map((maquina) => [maquina.id, maquina]));
    for (const reserva of reservas) {
      if (!reserva.maquinaId) continue;
      const maquina = maquinasPorId.get(reserva.maquinaId);
      if (!maquina) continue;

      const prescripcion = prescripcionPorSocio.get(reserva.socioId)?.get(reserva.ejercicioId);
      if (!prescripcion) {
        anomalia("reserva-sin-rutina", { asignacionId: reserva.id });
        continue;
      }

      maquina.cola.push({ series: prescripcion.series, descanso: prescripcion.descanso });
    }
  }
