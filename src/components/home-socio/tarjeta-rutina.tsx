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
  onSeguirRutina,
}: TarjetaRutinaProps) {
  if (!rutinaNombre) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        Sin rutina asignada
      </div>
    );
  }

  return (
    <div className="flex grow flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold text-gray-500">MI RUTINA ASIGNADA</p>
        <p className="text-lg font-bold text-gray-900">{rutinaNombre}</p>
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
                    <CheckCircle2 className="h-4 w-4 text-green-700" aria-hidden="true" />
                  )}
                  {estado === "actual" && (
                    <span className="h-2 w-2 rounded-full bg-[#FC4C02]" aria-hidden="true" />
                  )}
                  <p
                    className={`text-xl ${
                      estado === "actual"
                        ? "font-bold text-[#FC4C02]"
                        : estado === "completado"
                          ? "font-medium text-gray-900/70"
                          : "font-medium text-gray-900"
                    }`}
                  >
                    {ejercicio.nombre}
                  </p>
                </div>
                <p className="text-base text-gray-500">
                  {ejercicio.series}x{ejercicio.repeticiones}
                </p>
              </div>

              {i < ejercicios.length - 1 && (
                <div className="flex flex-col items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  <div className="flex flex-col items-center">
                    <p className="text-base font-medium text-gray-400">Descanso</p>
                    <p className="text-sm font-bold text-gray-400">
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
              className={`h-full grow rounded-[3px] ${
                estado === "completado"
                  ? "bg-green-700"
                  : estado === "actual"
                    ? "bg-[#FC4C02]"
                    : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSeguirRutina}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#FC4C02] text-[15px] font-bold text-white"
      >
        <Play className="h-[18px] w-[18px]" aria-hidden="true" />
        Seguir rutina
      </button>
    </div>
  );
}
