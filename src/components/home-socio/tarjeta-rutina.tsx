"use client";

import React from "react";
import { CheckCircle2, ChevronRight, Play } from "lucide-react";
import { formatDescansoLabel } from "./tarjeta-detalle";

/**
 * Tarjeta_Rutina — Active routine overview for Fila2 of Home_Socio.
 * Matches Home_Socio_1x design: a horizontal sequence of exercises with
 * rest-time connectors between them, a per-exercise progress bar, and a
 * single "Seguir rutina" action (not separate Iniciar/Siguiente/Finalizar
 * buttons — session-state transitions are the caller's concern via
 * onSeguirRutina).
 */
export interface EjercicioSecuencia {
  id: string;
  nombre: string;
  series: number;
  repeticiones: number;
  /** Rest AFTER this exercise, in seconds. Ignored for the last exercise. */
  descanso: number;
}

export type EstadoEjercicio = "completado" | "actual" | "pendiente";

export interface TarjetaRutinaProps {
  rutinaNombre: string | null;
  ejercicios: EjercicioSecuencia[];
  indiceActual: number;
  /** `true` cuando el socio ya tiene una sesión `EN_CURSO`: el CTA invita a retomarla (SE-4). */
  sesionEnProgreso?: boolean;
  onSeguirRutina?: () => void;
}

function estadoDe(index: number, indiceActual: number): EstadoEjercicio {
  if (index < indiceActual) return "completado";
  if (index === indiceActual) return "actual";
  return "pendiente";
}

export function TarjetaRutina({
  rutinaNombre,
  ejercicios,
  indiceActual,
  sesionEnProgreso = false,
  onSeguirRutina,
}: TarjetaRutinaProps) {
  if (!rutinaNombre) {
    return (
      <div
        data-testid="card-rutina"
        className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted"
      >
        Sin rutina asignada
      </div>
    );
  }

  return (
    <div
      data-testid="card-rutina"
      className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold text-ink-muted">MI RUTINA ASIGNADA</p>
        <p className="text-lg font-bold text-ink">{rutinaNombre}</p>
      </div>

      <div className="flex items-center justify-between">
        {ejercicios.map((ejercicio, i) => {
          const estado = estadoDe(i, indiceActual);
          return (
            <React.Fragment key={ejercicio.id}>
              <div
                data-testid={`ejercicio-${ejercicio.id}`}
                data-estado={estado}
                className={`flex flex-col items-center gap-2 ${
                  estado === "completado" ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-1">
                  {estado === "completado" && (
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                  )}
                  {estado === "actual" && (
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                  )}
                  <p
                    className={`text-xl ${
                      estado === "actual"
                        ? "font-bold text-brand"
                        : estado === "completado"
                          ? "font-medium text-ink/70"
                          : "font-medium text-ink"
                    }`}
                  >
                    {ejercicio.nombre}
                  </p>
                </div>
                <p className="text-base text-ink-muted">
                  {ejercicio.series}x{ejercicio.repeticiones}
                </p>
              </div>

              {i < ejercicios.length - 1 && (
                <div className="flex flex-col items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-ink-disabled" aria-hidden="true" />
                  <div className="flex flex-col items-center">
                    <p className="text-base font-medium text-ink-disabled">Descanso</p>
                    <p className="text-sm font-bold text-ink-disabled">
                      {formatDescansoLabel(ejercicio.descanso)}
                    </p>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex h-1.5 gap-1">
        {ejercicios.map((ejercicio, i) => {
          const estado = estadoDe(i, indiceActual);
          return (
            <div
              key={ejercicio.id}
              data-testid="progreso-segmento"
              data-estado={estado}
              className={`h-full grow rounded-sm ${
                estado === "completado"
                  ? "bg-success"
                  : estado === "actual"
                    ? "bg-brand"
                    : "bg-surface-active"
              }`}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSeguirRutina}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-strong text-[15px] font-bold text-surface"
      >
        <Play className="h-[18px] w-[18px]" aria-hidden="true" />
        {sesionEnProgreso ? "Retomar sesión" : "Seguir rutina"}
      </button>
    </div>
  );
}
