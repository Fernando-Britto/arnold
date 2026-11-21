"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LogOut } from "lucide-react";
import {
  fetchSesionEnCurso,
  iniciarSesionDeEntrenamiento,
  registrarSerieDeEntrenamiento,
  finalizarSesionDeEntrenamiento,
  fetchResumenDeSesion,
  type EjercicioDeSesionDTO,
  type SesionEnCursoDTO,
  type ResumenSesionDTO,
  type SerieMarcaDTO,
  type SugerenciaDTO,
  type UltimaVezDTO,
} from "@/api/sesiones";
import { calcularDescanso } from "@/domains/home-socio/descanso";
import { cargaInicial } from "@/domains/sesion/progresion-ejercicio";
import { contarProgreso } from "@/domains/sesion/progreso-sesion";
import { TIPO_SERIE_POR_DEFECTO, type TipoSerie } from "@/domains/sesion/tipo-serie";
import { AtribucionMedia, EjercicioVideo } from "@/components/ejercicio-crud/ejercicio-media";
import { SeccionCargando } from "./seccion-cargando";
import type { DropEnEdicion } from "./drops-de-serie";
import { EncabezadoEntrenamiento } from "./encabezado-entrenamiento";
import { RegistroSerie } from "./registro-serie";
import { HistorialSeries, type SerieLocal } from "./historial-series";
import { DescansoEntrenamiento, type SiguienteSerie } from "./descanso-entrenamiento";
import { ListaEjercicios } from "./lista-ejercicios";
import { ResumenDeSesion } from "./resumen-de-sesion";
import { UltimaVez } from "./ultima-vez";
import { handleApiError } from "@/utils/api-error";

/** Discos de peso disponibles: el stepper suma/resta este incremento (D-48). */
export const INCREMENTO_KG_DEFAULT = 2.5;
/** RIR por defecto al empezar una serie (0–5, D-48). */
export const RIR_DEFAULT = 2;

export interface EjecucionRutinaProps {
  /** Rutina asignada a ejecutar; null si el socio no tiene ninguna. */
  rutinaAsignadaId: string | null;
  /** Nombre de la rutina, para el encabezado. */
  rutinaNombre?: string | null;
  /** Incremento del stepper de peso, en kg (ReglaDeProgresion.incrementoSugerido). */
  incrementoKg?: number;
  /** Vuelve al inicio (cerrar la ejecución). */
  onCerrar?: () => void;
}

/**
 * Carga con la que arranca una serie: la sugerida si hay que subir o bajar (D-59), si no la de la
 * serie equivalente de la última vez (D-58). Sin historial, 0.
 */
function precarga(
  ejercicioId: string | null,
  numeroSerie: number,
  ultimasVeces: Record<string, UltimaVezDTO>,
  sugerencias: Record<string, SugerenciaDTO>
): number {
  if (!ejercicioId) return 0;
  return (
    cargaInicial(ultimasVeces[ejercicioId] ?? null, sugerencias[ejercicioId] ?? null, numeroSerie) ??
    0
  );
}

/** Lo que se muestra al completar todas las series de un ejercicio, antes de pasar al siguiente. */
interface TransicionDeEjercicio {
  nombre: string;
  series: number;
  repeticiones: number;
  siguienteNombre: string | null;
}

/**
 * Pantalla de ejecución de rutina (T-038, D-48). Al montar retoma la sesión en curso del
 * socio o inicia una nueva contra `POST /api/sesiones`. Registra cada serie con peso, reps
 * y RIR, y muestra el descanso calculado con la hora guardada.
 *
 * El historial de series vive en memoria y se pierde al recargar (decisión de producto): las
 * series anteriores a la recarga se muestran como hechas sin valores.
 */
export function EjecucionRutina({
  rutinaAsignadaId,
  rutinaNombre = null,
  incrementoKg = INCREMENTO_KG_DEFAULT,
  onCerrar,
}: EjecucionRutinaProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [finalizada, setFinalizada] = useState(false);
  const [resumen, setResumen] = useState<ResumenSesionDTO | null>(null);

  const [sesionId, setSesionId] = useState<string | null>(null);
  /** Cuándo empezó la sesión (ISO): de ahí sale el tiempo transcurrido del encabezado (T-049). */
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [ejercicios, setEjercicios] = useState<EjercicioDeSesionDTO[]>([]);
  const [ejercicioActualId, setEjercicioActualId] = useState<string | null>(null);
  const [serieActual, setSerieActual] = useState<number | null>(null);
  /** "Última vez" por ejercicio (D-58): series de la sesión anterior. */
  const [ultimasVeces, setUltimasVeces] = useState<Record<string, UltimaVezDTO>>({});
  const [sugerencias, setSugerencias] = useState<Record<string, SugerenciaDTO>>({});
  const [records, setRecords] = useState<Record<string, SerieMarcaDTO[]>>({});

  const [carga, setCarga] = useState(0);
  const [repeticiones, setRepeticiones] = useState(0);
  const [rir, setRir] = useState(RIR_DEFAULT);
  /** Tipo de la serie que se está por registrar (D-64); vuelve a Normal después de cada una. */
  const [tipo, setTipo] = useState<TipoSerie>(TIPO_SERIE_POR_DEFECTO);
  /** Drop sets colgados de la serie que se está por registrar (P-46, D-69); se mandan con ella. */
  const [drops, setDrops] = useState<DropEnEdicion[]>([]);
  /** Calentamientos hechos en el ejercicio actual: no son series de la rutina (D-64). */
  const [calentamientos, setCalentamientos] = useState(0);
  /** Series registradas en esta sesión para el ejercicio actual; se pierde al recargar. */
  const [historial, setHistorial] = useState<SerieLocal[]>([]);
  const [transicion, setTransicion] = useState<TransicionDeEjercicio | null>(null);

  const [descansoInicio, setDescansoInicio] = useState<Date | null>(null);
  const [descansoSegundos, setDescansoSegundos] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [pausaInicio, setPausaInicio] = useState<number | null>(null);
  const [pausaAcumuladaMs, setPausaAcumuladaMs] = useState(0);
  const [ajusteSegundos, setAjusteSegundos] = useState(0);

  const ejercicioActual = useMemo(
    () => ejercicios.find((e) => e.id === ejercicioActualId) ?? null,
    [ejercicios, ejercicioActualId]
  );

  const pausadoMs =
    pausaAcumuladaMs + (pausaInicio !== null ? Math.max(0, ahora - pausaInicio) : 0);

  const descanso = descansoInicio
    ? calcularDescanso(descansoInicio, descansoSegundos, new Date(ahora), {
        ajusteSegundos,
        pausadoMs,
      })
    : null;

  const siguienteSerie: SiguienteSerie | null =
    ejercicioActual && serieActual !== null
      ? {
          ejercicioNombre: ejercicioActual.nombre,
          numeroSerie: serieActual,
          totalSeries: ejercicioActual.series,
          repeticiones,
          cargaSugerida: carga,
        }
      : null;

  /** Series hechas y ejercicio actual contra lo que pide la rutina (T-049, D-67). */
  const progreso = useMemo(
    () => contarProgreso(ejercicios, ejercicioActualId, serieActual),
    [ejercicios, ejercicioActualId, serieActual]
  );

  const aplicarDetalle = useCallback((detalle: SesionEnCursoDTO) => {
    const sesion = detalle.sesion;
    if (!sesion) return;
    setSesionId(sesion.id);
    setHoraInicio(sesion.horaInicio);
    setEjercicios(detalle.ejercicios);
    setEjercicioActualId(sesion.ejercicioActualId);
    setSerieActual(sesion.serieActual);
    const ultimas = detalle.ultimasVeces ?? {};
    const sugeridas = detalle.sugerencias ?? {};
    setUltimasVeces(ultimas);
    setSugerencias(sugeridas);
    setRecords(detalle.records ?? {});

    const actual = detalle.ejercicios.find((e) => e.id === sesion.ejercicioActualId);
    // Carga reciente del ejercicio; si no hay, la sugerida o la de la última vez (D-58, D-59).
    setCarga(
      detalle.cargaActual?.carga ??
        precarga(sesion.ejercicioActualId, sesion.serieActual ?? 1, ultimas, sugeridas)
    );
    setRepeticiones(detalle.cargaActual?.repeticiones ?? actual?.repeticiones ?? 0);
    setRir(detalle.cargaActual?.rir ?? RIR_DEFAULT);

    // Retoma el cronómetro con la hora guardada de la última serie (D-48).
    if (detalle.ultimaSerie) {
      const deEjercicio = detalle.ejercicios.find((e) => e.id === detalle.ultimaSerie!.ejercicioId);
      const inicio = new Date(detalle.ultimaSerie.fecha);
      const segundos = deEjercicio?.descanso ?? 0;
      if (!calcularDescanso(inicio, segundos, new Date()).expirado) {
        setDescansoInicio(inicio);
        setDescansoSegundos(segundos);
        setAhora(Date.now());
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const detalle = await fetchSesionEnCurso();
        if (cancelled) return;
        if (detalle.sesion) {
          aplicarDetalle(detalle);
        } else if (rutinaAsignadaId) {
          const iniciada = await iniciarSesionDeEntrenamiento(rutinaAsignadaId);
          if (cancelled) return;
          setSesionId(iniciada.sesion.id);
          setHoraInicio(iniciada.sesion.horaInicio);
          setEjercicios(iniciada.ejercicios);
          setEjercicioActualId(iniciada.sesion.ejercicioActualId);
          setSerieActual(iniciada.sesion.serieActual);
          const ultimas = iniciada.ultimasVeces ?? {};
          const sugeridas = iniciada.sugerencias ?? {};
          setUltimasVeces(ultimas);
          setSugerencias(sugeridas);
          setRecords(iniciada.records ?? {});
          const actual = iniciada.ejercicios.find(
            (e) => e.id === iniciada.sesion.ejercicioActualId
          );
          setCarga(precarga(iniciada.sesion.ejercicioActualId, 1, ultimas, sugeridas));
          setRepeticiones(actual?.repeticiones ?? 0);
          setRir(RIR_DEFAULT);
        } else {
          setError("No tenés una rutina asignada.");
        }
      } catch (err) {
        if (!cancelled) setError(handleApiError(err, "No pudimos cargar la sesión."));
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rutinaAsignadaId, aplicarDetalle]);

  // El reloj corre mientras hay un descanso en curso o la sesión está abierta (el encabezado
  // muestra el tiempo transcurrido). Un solo intervalo sirve para las dos cosas.
  const hayReloj = descansoInicio !== null || (horaInicio !== null && !finalizada);
  useEffect(() => {
    if (!hayReloj) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hayReloj]);

  const limpiarDescanso = () => {
    setDescansoInicio(null);
    setDescansoSegundos(0);
    setAjusteSegundos(0);
    setPausaInicio(null);
    setPausaAcumuladaMs(0);
  };

  const continuarEntrenamiento = () => {
    setTransicion(null);
    limpiarDescanso();
  };

  const pausarDescanso = () => {
    if (descansoInicio && pausaInicio === null) setPausaInicio(Date.now());
  };

  const reanudarDescanso = () => {
    if (pausaInicio !== null) {
      setPausaAcumuladaMs((ms) => ms + Math.max(0, Date.now() - pausaInicio));
      setPausaInicio(null);
    }
  };

  const ajustarDescanso = (deltaSegundos: number) => {
    setAjusteSegundos((segundos) => segundos + deltaSegundos);
  };

  /** Elegir "Al fallo" implica RIR 0: el socio no tiene que marcar las dos cosas. */
  const elegirTipo = (elegido: TipoSerie) => {
    setTipo(elegido);
    if (elegido === "HASTA_EL_FALLO") setRir(0);
    // Un calentamiento no lleva drop sets: se descartan para que no reaparezcan al volver a Normal.
    if (elegido === "CALENTAMIENTO") setDrops([]);
  };

  const handleSerieHecha = async ({
    repeticiones: reps,
    carga: peso,
  }: {
    repeticiones: number;
    carga: number;
  }) => {
    if (!sesionId || !ejercicioActualId || !ejercicioActual) return;
    setError(null);
    setEnviando(true);

    // La serie que se está registrando es la previa al avance del servidor.
    const numeroSerieAntes = serieActual ?? 1;
    const tipoAntes = tipo;

    try {
      const resultado = await registrarSerieDeEntrenamiento(sesionId, {
        ejercicioId: ejercicioActualId,
        carga: peso,
        repeticiones: reps,
        rir,
        // Sin `tipo` el servidor usa NORMAL: solo se manda cuando es otro (D-64).
        ...(tipoAntes !== TIPO_SERIE_POR_DEFECTO ? { tipo: tipoAntes } : {}),
        // P-46, D-69: los drop sets viajan con la serie, en la misma petición.
        ...(drops.length > 0 ? { drops } : {}),
      });

      // El tipo vale para UNA serie: la siguiente arranca en Normal. Si fue al fallo, el RIR 0
      // lo puso el tipo y no tiene por qué quedar para la serie que sigue.
      setTipo(TIPO_SERIE_POR_DEFECTO);
      setDrops([]);
      if (tipoAntes === "HASTA_EL_FALLO") setRir(RIR_DEFAULT);
      if (tipoAntes === "CALENTAMIENTO") setCalentamientos((n) => n + 1);

      const registroLocal: SerieLocal = {
        numeroSerie: tipoAntes === "CALENTAMIENTO" ? null : numeroSerieAntes,
        carga: peso,
        repeticiones: reps,
        rir,
        tipo: tipoAntes,
        drops: drops.length,
      };
      const nuevoHistorial = [...historial, registroLocal];
      setHistorial(nuevoHistorial);

      if (resultado.sesion.ejercicioActualId === null) {
        // Última serie: cierra la sesión y muestra el resumen (D-48).
        limpiarDescanso();
        await finalizarSesionDeEntrenamiento(sesionId);
        // El resumen es un extra (T-046b, D-62): si falla, igual se muestra que la rutina terminó.
        try {
          setResumen((await fetchResumenDeSesion(sesionId)) ?? null);
        } catch {
          setResumen(null);
        }
        setEjercicioActualId(null);
        setSerieActual(null);
        setFinalizada(true);
        return;
      }

      const siguienteId = resultado.sesion.ejercicioActualId;

      if (tipoAntes !== "CALENTAMIENTO" && numeroSerieAntes >= ejercicioActual.series) {
        // Se terminó el ejercicio: el backend ya avanzó. Sin descanso: se muestra la transición.
        const siguiente = ejercicios.find((e) => e.id === siguienteId);
        const repeticionesHechas = nuevoHistorial
          .filter((serie) => serie.tipo !== "CALENTAMIENTO")
          .reduce((total, serie) => total + serie.repeticiones, 0);
        setTransicion({
          nombre: ejercicioActual.nombre,
          series: ejercicioActual.series,
          repeticiones: repeticionesHechas,
          siguienteNombre: siguiente?.nombre ?? null,
        });
        setHistorial([]);
        setCalentamientos(0);
      } else if (tipoAntes !== "DROP_SET") {
        // Arranca el descanso con la hora guardada por el servidor. Un drop set cuelga de la
        // serie anterior: no dispara el descanso largo (D-64).
        setDescansoInicio(new Date(resultado.registro.fecha));
        setDescansoSegundos(ejercicioActual.descanso);
        setAhora(Date.now());
        setPausaInicio(null);
        setPausaAcumuladaMs(0);
        setAjusteSegundos(0);
      }

      setEjercicioActualId(siguienteId);
      setSerieActual(resultado.sesion.serieActual);
      if (siguienteId !== ejercicioActualId) {
        setCalentamientos(0);
        setHistorial([]);
        const siguiente = ejercicios.find((e) => e.id === siguienteId);
        setRepeticiones(siguiente?.repeticiones ?? 0);
        setCarga(precarga(siguienteId, 1, ultimasVeces, sugerencias));
        setRir(RIR_DEFAULT);
      }
    } catch (err) {
      setError(handleApiError(err, "No se pudo registrar la serie."));
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div data-testid="ejecucion-rutina" className="p-6 text-ink-muted">
        <SeccionCargando className="h-40" />
      </div>
    );
  }

  if (finalizada) {
    const seriesFallback = resumen?.seriesHechas ?? ejercicios.reduce((t, e) => t + e.series, 0);
    const repeticionesTotales =
      resumen?.ejercicios.reduce(
        (total, ejercicio) =>
          total +
          ejercicio.hoy
            .filter((serie) => serie.tipo !== "DROP_SET")
            .reduce((suma, serie) => suma + serie.repeticiones, 0),
        0
      ) ?? 0;

    return (
      <div
        data-testid="ejecucion-rutina"
        role="status"
        className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center"
      >
        <Check className="h-10 w-10 text-success" aria-hidden="true" />
        <h2 className="text-2xl font-black text-ink">¡Entrenamiento completado!</h2>
        <p className="text-sm text-ink-muted">Terminaste tu rutina de hoy.</p>

        {resumen && (
          <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <Metrica etiqueta="Ejercicios" valor={String(resumen.ejercicios.length)} testId="metrica-ejercicios" />
            <Metrica etiqueta="Series" valor={String(resumen.seriesHechas)} testId="metrica-series" />
            <Metrica etiqueta="Repeticiones" valor={String(repeticionesTotales)} testId="metrica-repeticiones" />
            <Metrica
              etiqueta="Duración"
              valor={resumen.duracionMinutos !== null ? `${resumen.duracionMinutos} min` : "—"}
              testId="metrica-duracion"
            />
          </dl>
        )}

        {resumen && resumen.ejercicios.length > 0 ? (
          <ResumenDeSesion resumen={resumen} />
        ) : (
          <p className="text-sm text-ink-muted">Registraste {seriesFallback} series.</p>
        )}

        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="mt-2 rounded-lg bg-brand-strong px-4 py-2 font-bold text-surface"
          >
            Finalizar entrenamiento
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid="ejecucion-rutina" className="flex grow flex-col gap-5">
      {onCerrar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="flex items-center gap-1 text-sm font-medium text-ink-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Salir
          </button>
        </div>
      )}

      {horaInicio !== null && (
        <EncabezadoEntrenamiento
          rutinaNombre={rutinaNombre}
          hechas={progreso.hechas}
          total={progreso.total}
          ejercicioNumero={progreso.ejercicioNumero}
          ejerciciosTotal={progreso.ejerciciosTotal}
          transcurridoMs={ahora - new Date(horaInicio).getTime()}
        />
      )}

      {transicion ? (
        <section
          data-testid="transicion-ejercicio"
          role="status"
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center"
        >
          <Check className="h-10 w-10 text-success" aria-hidden="true" />
          <h2 className="text-2xl font-black text-ink">¡Ejercicio completado!</h2>
          <p className="font-bold text-ink">{transicion.nombre}</p>
          <p className="text-sm text-ink-muted">
            {transicion.series} {transicion.series === 1 ? "serie" : "series"} ·{" "}
            {transicion.repeticiones} repeticiones
          </p>
          {transicion.siguienteNombre && (
            <p className="text-sm text-ink-muted">
              Siguiente: <span className="font-bold text-ink">{transicion.siguienteNombre}</span>
            </p>
          )}
          <button
            type="button"
            onClick={continuarEntrenamiento}
            className="mt-2 rounded-lg bg-brand-strong px-4 py-2 font-bold text-surface"
          >
            Continuar al siguiente ejercicio
          </button>
        </section>
      ) : descanso ? (
        <DescansoEntrenamiento
          restanteSegundos={descanso.restanteSegundos}
          expirado={descanso.expirado}
          pausado={pausaInicio !== null}
          siguiente={siguienteSerie}
          onMas15={() => ajustarDescanso(15)}
          onMenos15={() => ajustarDescanso(-15)}
          onPausar={pausarDescanso}
          onReanudar={reanudarDescanso}
          onContinuar={continuarEntrenamiento}
        />
      ) : ejercicioActual ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[45fr_55fr]">
            {/* Columna izquierda: el ejercicio que se está haciendo. */}
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
              <p className="text-xs font-bold text-brand">EJERCICIO ACTUAL</p>
              <h3 className="text-xl font-black text-ink">{ejercicioActual.nombre}</h3>
              {ejercicioActual.musculoObjetivo && (
                <p className="text-sm text-ink-muted">{ejercicioActual.musculoObjetivo}</p>
              )}
              <p className="text-sm font-semibold text-ink-muted">
                {ejercicioActual.series} {ejercicioActual.series === 1 ? "serie" : "series"}
              </p>
              {calentamientos > 0 && (
                <p data-testid="calentamientos" className="text-xs text-ink-muted">
                  Calentamientos: {calentamientos}
                </p>
              )}

              {/* La media del catálogo solo existe si el ejercicio la tiene cargada (D-70). */}
              {ejercicioActual.mediaId && (
                <div className="flex flex-col gap-2">
                  <EjercicioVideo
                    mediaId={ejercicioActual.mediaId}
                    nombre={ejercicioActual.nombre}
                    ancho={320}
                  />
                  <AtribucionMedia />
                </div>
              )}

              {/* Las instrucciones no dependen de que haya animación cargada. */}
              {(ejercicioActual.instrucciones ?? []).length > 0 && (
                <details className="text-sm text-ink-muted">
                  <summary className="cursor-pointer font-bold text-brand">Cómo se hace</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {(ejercicioActual.instrucciones ?? []).map((paso, i) => (
                      <li key={i}>{paso}</li>
                    ))}
                  </ol>
                </details>
              )}

              <UltimaVez
                ultimaVez={ultimasVeces[ejercicioActual.id] ?? null}
                serieActual={serieActual}
                ahora={ahora}
                sugerencia={sugerencias[ejercicioActual.id] ?? null}
              />
            </section>

            {/* Columna derecha: registro de la serie e historial local. */}
            <div className="flex flex-col gap-5">
              <RegistroSerie
                ejercicio={ejercicioActual}
                serieActual={serieActual ?? 1}
                repeticiones={repeticiones}
                onRepeticiones={setRepeticiones}
                carga={carga}
                onCarga={setCarga}
                rir={rir}
                onRir={setRir}
                tipo={tipo}
                onTipo={elegirTipo}
                drops={drops}
                onDrops={setDrops}
                enviando={enviando}
                error={error}
                onRegistrar={handleSerieHecha}
                records={records[ejercicioActual.id] ?? []}
                incrementoKg={incrementoKg}
              />
              <HistorialSeries
                planificadas={ejercicioActual.series}
                repeticionesPlanificadas={ejercicioActual.repeticiones}
                serieActual={serieActual}
                historial={historial}
              />
            </div>
          </div>

          <ListaEjercicios ejercicios={ejercicios} actualId={ejercicioActualId} />
        </>
      ) : error ? (
        <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-ink-muted">No hay un ejercicio en curso.</p>
      )}
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  testId,
}: {
  etiqueta: string;
  valor: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-3">
      <dt className="text-xs font-bold text-ink-muted">{etiqueta}</dt>
      <dd data-testid={testId} className="text-lg font-black text-ink">
        {valor}
      </dd>
    </div>
  );
}
