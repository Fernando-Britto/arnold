"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LogOut, Minus, Plus, TimerReset } from "lucide-react";
import {
  fetchSesionEnCurso,
  iniciarSesionDeEntrenamiento,
  registrarSerieDeEntrenamiento,
  finalizarSesionDeEntrenamiento,
  type EjercicioDeSesionDTO,
  type SesionEnCursoDTO,
} from "@/api/sesiones";
import { calcularDescanso, formatearDescanso } from "@/domains/home-socio/descanso";
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

  const [sesionId, setSesionId] = useState<string | null>(null);
  const [ejercicios, setEjercicios] = useState<EjercicioDeSesionDTO[]>([]);
  const [ejercicioActualId, setEjercicioActualId] = useState<string | null>(null);
  const [serieActual, setSerieActual] = useState<number | null>(null);

  const [carga, setCarga] = useState(0);
  const [repeticiones, setRepeticiones] = useState(0);
  const [rir, setRir] = useState(RIR_DEFAULT);

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

  const aplicarDetalle = useCallback((detalle: SesionEnCursoDTO) => {
    const sesion = detalle.sesion;
    if (!sesion) return;
    setSesionId(sesion.id);
    setEjercicios(detalle.ejercicios);
    setEjercicioActualId(sesion.ejercicioActualId);
    setSerieActual(sesion.serieActual);

    const actual = detalle.ejercicios.find((e) => e.id === sesion.ejercicioActualId);
    setCarga(detalle.cargaActual?.carga ?? 0);
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
          setEjercicios(iniciada.ejercicios);
          setEjercicioActualId(iniciada.sesion.ejercicioActualId);
          setSerieActual(iniciada.sesion.serieActual);
          const actual = iniciada.ejercicios.find(
            (e) => e.id === iniciada.sesion.ejercicioActualId
          );
          setCarga(0);
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

  useEffect(() => {
    if (!descansoInicio) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [descansoInicio]);

  const sumarRepeticion = () => setRepeticiones((r) => r + 1);
  const restarRepeticion = () => setRepeticiones((r) => Math.max(1, r - 1));
  const sumarPeso = () => setCarga((c) => redondear(c + incrementoKg));
  const restarPeso = () => setCarga((c) => Math.max(0, redondear(c - incrementoKg)));
  const saltarDescanso = () => {
    setDescansoInicio(null);
    setDescansoSegundos(0);
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
      });

      if (resultado.sesion.ejercicioActualId === null) {
        // Última serie: cierra la sesión y muestra el resumen (D-48).
        saltarDescanso();
        await finalizarSesionDeEntrenamiento(sesionId);
        setEjercicioActualId(null);
        setSerieActual(null);
        setFinalizada(true);
        return;
      }

      // Arranca el descanso con la hora guardada por el servidor.
      setDescansoInicio(new Date(resultado.registro.fecha));
      setDescansoSegundos(ejercicioActual.descanso);
      setAhora(Date.now());

      const siguienteId = resultado.sesion.ejercicioActualId;
      setEjercicioActualId(siguienteId);
      setSerieActual(resultado.sesion.serieActual);
      if (siguienteId !== ejercicioActualId) {
        const siguiente = ejercicios.find((e) => e.id === siguienteId);
        setRepeticiones(siguiente?.repeticiones ?? 0);
        setCarga(0);
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
      <div data-testid="ejecucion-rutina" className="p-6 text-gray-500">
        Cargando la sesión...
      </div>
    );
  }

  if (finalizada) {
    return (
      <div
        data-testid="ejecucion-rutina"
        role="status"
        className="flex flex-col items-center gap-3 rounded-3xl border border-gray-200 bg-white p-8 text-center"
      >
        <Check className="h-10 w-10 text-green-700" aria-hidden="true" />
        <p className="text-xl font-bold text-gray-900">¡Rutina completada!</p>
        <p className="text-sm text-gray-500">
          Registraste {ejercicios.reduce((total, e) => total + e.series, 0)} series.
        </p>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="mt-2 rounded-lg bg-[#FC4C02] px-4 py-2 font-bold text-white"
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
      className="flex grow flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-[#FC4C02]">EJECUTANDO RUTINA</p>
          {ejercicioActual && (
            <h2 className="text-2xl font-bold text-gray-900">{ejercicioActual.nombre}</h2>
          )}
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="flex items-center gap-1 text-sm font-medium text-gray-500"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Salir
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {ejercicioActual && (
        <>
          <p className="text-sm font-medium text-gray-500">
            Serie {serieActual ?? 1} de {ejercicioActual.series}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Repeticiones */}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 p-4">
              <span className="text-xs font-bold text-gray-500">REPETICIONES</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={restarRepeticion}
                  aria-label="Restar una repetición"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span data-testid="valor-repeticiones" className="text-3xl font-bold text-gray-900">
                  {repeticiones}
                </span>
                <button
                  type="button"
                  onClick={sumarRepeticion}
                  aria-label="Sumar una repetición"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Peso */}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 p-4">
              <span className="text-xs font-bold text-gray-500">PESO (KG)</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={restarPeso}
                  aria-label="Restar peso"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span data-testid="valor-carga" className="text-3xl font-bold text-gray-900">
                  {carga}
                </span>
                <button
                  type="button"
                  onClick={sumarPeso}
                  aria-label="Sumar peso"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* RIR */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-500">RIR (repeticiones en reserva)</span>
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
                      ? "border-[#FC4C02] bg-[#FC4C02] text-white"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  {valor}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSerieHecha}
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#FC4C02] text-[15px] font-bold text-white disabled:bg-gray-400"
          >
            <Check className="h-[18px] w-[18px]" aria-hidden="true" />
            {enviando ? "Guardando..." : "Serie hecha"}
          </button>

          {descanso && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4"
            >
              <div className="flex items-center gap-2 text-amber-900">
                <TimerReset className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-bold">Descanso</span>
              </div>
              {descanso.expirado ? (
                <p data-testid="descanso-terminado" className="text-lg font-bold text-green-700">
                  ¡Descanso terminado!
                </p>
              ) : (
                <p data-testid="descanso-tiempo" className="text-3xl font-bold text-amber-900">
                  {formatearDescanso(descanso.restanteSegundos)}
                </p>
              )}
              <button
                type="button"
                onClick={saltarDescanso}
                className="text-sm font-bold text-[#FC4C02] underline"
              >
                Saltar
              </button>
            </div>
          )}
        </>
      )}

      {!ejercicioActual && !error && (
        <p className="text-gray-500">No hay un ejercicio en curso.</p>
      )}
    </div>
  );
}
