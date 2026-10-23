"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LogOut, Minus, Plus, TimerReset } from "lucide-react";
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
import { calcularDescanso, formatearDescanso } from "@/domains/home-socio/descanso";
import { cargaInicial } from "@/domains/sesion/progresion-ejercicio";
import { contarProgreso } from "@/domains/sesion/progreso-sesion";
import {
  ETIQUETAS_TIPO_SERIE,
  TIPOS_ELEGIBLES,
  TIPO_SERIE_POR_DEFECTO,
  type TipoSerie,
} from "@/domains/sesion/tipo-serie";
import { AtribucionMedia, EjercicioVideo } from "@/components/ejercicio-crud/ejercicio-media";
import { RecordEnVivo } from "./record-en-vivo";
import { DropsDeSerie, type DropEnEdicion } from "./drops-de-serie";
import { EncabezadoDeSesion } from "./encabezado-de-sesion";
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
  /** Incremento del stepper de peso, en kg (ReglaDeProgresion.incrementoSugerido). */
  incrementoKg?: number;
  /** Vuelve al inicio (cerrar la ejecución). */
  onCerrar?: () => void;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
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

/**
 * Pantalla de ejecución de rutina (T-038, D-48). Al montar retoma la sesión en curso del
 * socio o inicia una nueva contra `POST /api/sesiones`. Registra cada serie con peso, reps
 * y RIR, y muestra el cronómetro de descanso calculado con la hora guardada.
 */
export function EjecucionRutina({
  rutinaAsignadaId,
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

  const [descansoInicio, setDescansoInicio] = useState<Date | null>(null);
  const [descansoSegundos, setDescansoSegundos] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  const ejercicioActual = useMemo(
    () => ejercicios.find((e) => e.id === ejercicioActualId) ?? null,
    [ejercicios, ejercicioActualId]
  );

  const descanso = descansoInicio
    ? calcularDescanso(descansoInicio, descansoSegundos, new Date(ahora))
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

  const sumarRepeticion = () => setRepeticiones((r) => r + 1);
  const restarRepeticion = () => setRepeticiones((r) => Math.max(1, r - 1));
  const sumarPeso = () => setCarga((c) => redondear(c + incrementoKg));
  const restarPeso = () => setCarga((c) => Math.max(0, redondear(c - incrementoKg)));
  const saltarDescanso = () => {
    setDescansoInicio(null);
    setDescansoSegundos(0);
  };

  /** Elegir "Al fallo" implica RIR 0: el socio no tiene que marcar las dos cosas. */
  const elegirTipo = (elegido: TipoSerie) => {
    setTipo(elegido);
    if (elegido === "HASTA_EL_FALLO") setRir(0);
    // Un calentamiento no lleva drop sets: se descartan para que no reaparezcan al volver a Normal.
    if (elegido === "CALENTAMIENTO") setDrops([]);
  };

  const handleSerieHecha = async () => {
    if (!sesionId || !ejercicioActualId || !ejercicioActual) return;
    setError(null);
    setEnviando(true);
    try {
      const resultado = await registrarSerieDeEntrenamiento(sesionId, {
        ejercicioId: ejercicioActualId,
        carga,
        repeticiones,
        rir,
        // Sin `tipo` el servidor usa NORMAL: solo se manda cuando es otro (D-64).
        ...(tipo !== TIPO_SERIE_POR_DEFECTO ? { tipo } : {}),
        // P-46, D-69: los drop sets viajan con la serie, en la misma petición.
        ...(drops.length > 0 ? { drops } : {}),
      });

      // El tipo vale para UNA serie: la siguiente arranca en Normal. Si fue al fallo, el RIR 0
      // lo puso el tipo y no tiene por qué quedar para la serie que sigue.
      setTipo(TIPO_SERIE_POR_DEFECTO);
      setDrops([]);
      if (tipo === "HASTA_EL_FALLO") setRir(RIR_DEFAULT);
      if (tipo === "CALENTAMIENTO") setCalentamientos((n) => n + 1);

      if (resultado.sesion.ejercicioActualId === null) {
        // Última serie: cierra la sesión y muestra el resumen (D-48).
        saltarDescanso();
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

      // Arranca el descanso con la hora guardada por el servidor. Un drop set cuelga de la
      // serie anterior: no dispara el descanso largo (D-64).
      if (tipo !== "DROP_SET") {
        setDescansoInicio(new Date(resultado.registro.fecha));
        setDescansoSegundos(ejercicioActual.descanso);
        setAhora(Date.now());
      }

      const siguienteId = resultado.sesion.ejercicioActualId;
      setEjercicioActualId(siguienteId);
      setSerieActual(resultado.sesion.serieActual);
      if (siguienteId !== ejercicioActualId) {
        setCalentamientos(0);
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
        Cargando la sesión...
      </div>
    );
  }

  if (finalizada) {
    return (
      <div
        data-testid="ejecucion-rutina"
        role="status"
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center"
      >
        <Check className="h-10 w-10 text-success" aria-hidden="true" />
        <p className="text-xl font-bold text-ink">¡Rutina completada!</p>
        {resumen && resumen.ejercicios.length > 0 ? (
          <ResumenDeSesion resumen={resumen} />
        ) : (
          <p className="text-sm text-ink-muted">
            Registraste {ejercicios.reduce((total, e) => total + e.series, 0)} series.
          </p>
        )}
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="mt-2 rounded-lg bg-brand-strong px-4 py-2 font-bold text-surface"
          >
            Volver al inicio
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="ejecucion-rutina"
      className="flex grow flex-col gap-5 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-brand">EJECUTANDO RUTINA</p>
          {ejercicioActual && (
            <h2 className="text-2xl font-bold text-ink">{ejercicioActual.nombre}</h2>
          )}
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="flex items-center gap-1 text-sm font-medium text-ink-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Salir
          </button>
        )}
      </div>

      {horaInicio !== null && (
        <EncabezadoDeSesion
          hechas={progreso.hechas}
          total={progreso.total}
          ejercicioNumero={progreso.ejercicioNumero}
          ejerciciosTotal={progreso.ejerciciosTotal}
          transcurridoMs={ahora - new Date(horaInicio).getTime()}
        />
      )}

      {error && (
        <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Animación del ejercicio actual (catálogo, T-050f, D-70): las instrucciones van en un desplegable
          cerrado para no empujar hacia abajo el registro de series. */}
      {ejercicioActual?.mediaId && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <EjercicioVideo mediaId={ejercicioActual.mediaId} nombre={ejercicioActual.nombre} />
            {ejercicioActual.musculoObjetivo && (
              <p className="text-sm text-ink-muted">{ejercicioActual.musculoObjetivo}</p>
            )}
          </div>
          {ejercicioActual.instrucciones.length > 0 && (
            <details className="text-sm text-ink-muted">
              <summary className="cursor-pointer font-bold text-brand">Cómo se hace</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {ejercicioActual.instrucciones.map((paso, i) => (
                  <li key={i}>{paso}</li>
                ))}
              </ol>
            </details>
          )}
          <AtribucionMedia />
        </div>
      )}

      {ejercicioActual && (
        <>
          <p className="text-sm font-medium text-ink-muted">
            Serie {serieActual ?? 1} de {ejercicioActual.series}
          </p>
          {calentamientos > 0 && (
            <p data-testid="calentamientos" className="text-xs text-ink-muted">
              Calentamientos: {calentamientos}
            </p>
          )}

          <UltimaVez
            ultimaVez={ultimasVeces[ejercicioActual.id] ?? null}
            serieActual={serieActual}
            ahora={ahora}
            sugerencia={sugerencias[ejercicioActual.id] ?? null}
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Repeticiones */}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-4">
              <span className="text-xs font-bold text-ink-muted">REPETICIONES</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={restarRepeticion}
                  aria-label="Restar una repetición"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span data-testid="valor-repeticiones" className="text-3xl font-bold text-ink">
                  {repeticiones}
                </span>
                <button
                  type="button"
                  onClick={sumarRepeticion}
                  aria-label="Sumar una repetición"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Peso */}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-4">
              <span className="text-xs font-bold text-ink-muted">PESO (KG)</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={restarPeso}
                  aria-label="Restar peso"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span data-testid="valor-carga" className="text-3xl font-bold text-ink">
                  {carga}
                </span>
                <button
                  type="button"
                  onClick={sumarPeso}
                  aria-label="Sumar peso"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-ink-soft"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Un calentamiento no cuenta para las marcas (D-64): no tiene sentido avisar un récord. */}
          {tipo !== "CALENTAMIENTO" && (
            <RecordEnVivo frontera={records[ejercicioActual.id] ?? []} carga={carga} />
          )}

          {/* RIR */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-muted">RIR (repeticiones en reserva)</span>
            <div role="group" aria-label="RIR" className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setRir(valor)}
                  aria-label={`RIR ${valor}`}
                  aria-pressed={rir === valor}
                  className={`h-10 w-10 rounded-lg border text-sm font-bold ${
                    rir === valor
                      ? "border-brand bg-brand-strong text-surface"
                      : "border-border bg-surface text-ink-soft"
                  }`}
                >
                  {valor}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de serie (T-047, D-64) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-muted">TIPO DE SERIE</span>
            <div role="group" aria-label="Tipo de serie" className="flex flex-wrap gap-2">
              {TIPOS_ELEGIBLES.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => elegirTipo(opcion)}
                  aria-pressed={tipo === opcion}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    tipo === opcion
                      ? "border-brand bg-orange-50 text-ink"
                      : "border-border bg-surface text-ink-soft"
                  }`}
                >
                  {ETIQUETAS_TIPO_SERIE[opcion]}
                </button>
              ))}
            </div>
            {tipo === "CALENTAMIENTO" && (
              <p className="text-xs text-ink-muted">
                No cuenta como una de las series de la rutina ni para tu progreso.
              </p>
            )}
          </div>

          {/* Drop sets (P-46, D-69): cuelgan de esta serie, no son series de la rutina. */}
          {tipo !== "CALENTAMIENTO" && (
            <DropsDeSerie
              drops={drops}
              onChange={setDrops}
              cargaBase={carga}
              repeticionesBase={repeticiones}
              deshabilitado={enviando}
            />
          )}

          <button
            type="button"
            onClick={handleSerieHecha}
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-strong text-[15px] font-bold text-surface disabled:bg-ink-disabled"
          >
            <Check className="h-[18px] w-[18px]" aria-hidden="true" />
            {enviando
              ? "Guardando..."
              : tipo === "CALENTAMIENTO"
                ? "Calentamiento hecho"
                : "Serie hecha"}
          </button>

          {descanso && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-2 rounded-2xl border border-warning bg-warning-soft p-4"
            >
              <div className="flex items-center gap-2 text-warning">
                <TimerReset className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-bold">Descanso</span>
              </div>
              {descanso.expirado ? (
                <p data-testid="descanso-terminado" className="text-lg font-bold text-success">
                  ¡Descanso terminado!
                </p>
              ) : (
                <p data-testid="descanso-tiempo" className="text-3xl font-bold text-warning">
                  {formatearDescanso(descanso.restanteSegundos)}
                </p>
              )}
              <button
                type="button"
                onClick={saltarDescanso}
                className="text-sm font-bold text-brand underline"
              >
                Saltar
              </button>
            </div>
          )}
        </>
      )}

      {!ejercicioActual && !error && (
        <p className="text-ink-muted">No hay un ejercicio en curso.</p>
      )}
    </div>
  );
}
