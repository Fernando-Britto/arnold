"use client";

import React from "react";
import type { SugerenciaDTO, UltimaVezDTO } from "@/api/sesiones";
import { describirHace, formatearSerie } from "@/domains/sesion/historial-ejercicio";
import { SugerenciaProgresion } from "./sugerencia-progresion";

/**
 * "Última vez" de un ejercicio (D-58): las series de la sesión anterior, para saber con qué
 * cargas e intensidad seguir. La serie que se está por hacer queda resaltada. Debajo, la carga
 * que se sugiere para hoy y por qué (D-59).
 */
export interface UltimaVezProps {
  /** null = el socio nunca hizo este ejercicio. */
  ultimaVez: UltimaVezDTO | null;
  /** Número (1-based) de la serie en curso, para resaltar la equivalente de la última vez. */
  serieActual: number | null;
  /** Instante actual en ms; viene del estado del padre para que el render sea puro. */
  ahora: number;
  /** Carga sugerida para hoy y su motivo (D-59); null si no hay historial. */
  sugerencia?: SugerenciaDTO | null;
}

export function UltimaVez({ ultimaVez, serieActual, ahora, sugerencia = null }: UltimaVezProps) {
  if (!ultimaVez || ultimaVez.series.length === 0) {
    return (
      <p data-testid="ultima-vez" className="text-sm text-gray-500">
        Primera vez con este ejercicio.
      </p>
    );
  }

  return (
    <div data-testid="ultima-vez" className="flex flex-col gap-2">
      <p className="text-xs font-bold text-gray-500">
        ÚLTIMA VEZ · {describirHace(new Date(ultimaVez.fecha), new Date(ahora)).toUpperCase()}
      </p>
      <ul className="flex flex-wrap gap-2">
        {ultimaVez.series.map((serie, i) => {
          const actual = serieActual === i + 1;
          return (
            <li
              key={i}
              data-testid="ultima-vez-serie"
              aria-current={actual ? "true" : undefined}
              className={`rounded-lg border px-2 py-1 text-xs ${
                actual
                  ? "border-[#FC4C02] bg-orange-50 font-bold text-gray-900"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {formatearSerie(serie)}
            </li>
          );
        })}
      </ul>
      {sugerencia && <SugerenciaProgresion sugerencia={sugerencia} />}
    </div>
  );
}
