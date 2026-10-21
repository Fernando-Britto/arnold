"use client";

import React from "react";
import { Timer } from "lucide-react";
import { formatearTranscurrido, porcentajeDeProgreso } from "@/domains/sesion/progreso-sesion";

/**
 * Encabezado de la pantalla de entrenamiento (T-049, D-67): en qué ejercicio va, cuántas series
 * hizo de las que pide la rutina, cuánto lleva entrenando y una barra de progreso.
 *
 * El reloj se actualiza solo y NO se anuncia a los lectores de pantalla (cambia cada segundo);
 * la barra, en cambio, sí es una barra de progreso con su texto en palabras.
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */
export interface EncabezadoDeSesionProps {
  hechas: number;
  total: number;
  /** Posición (1-based) del ejercicio actual; `null` si no se pudo ubicar. */
  ejercicioNumero: number | null;
  ejerciciosTotal: number;
  /** Tiempo desde que empezó la sesión, en milisegundos. */
  transcurridoMs: number;
}

export function EncabezadoDeSesion({
  hechas,
  total,
  ejercicioNumero,
  ejerciciosTotal,
  transcurridoMs,
}: EncabezadoDeSesionProps) {
  return (
    <div data-testid="encabezado-de-sesion" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
        {ejercicioNumero !== null ? (
          <span data-testid="sesion-ejercicio" className="font-semibold">
            Ejercicio {ejercicioNumero} de {ejerciciosTotal}
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1.5">
          <Timer className="h-4 w-4" aria-hidden="true" />
          <span data-testid="sesion-tiempo" className="tabular-nums">
            {formatearTranscurrido(transcurridoMs)}
          </span>
          <span aria-hidden="true">·</span>
          <span data-testid="sesion-series" className="tabular-nums">
            {hechas}/{total} series
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progreso de la sesión"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hechas}
        aria-valuetext={`${hechas} de ${total} series`}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          data-testid="sesion-relleno"
          className="h-full rounded-full bg-[#FC4C02] transition-[width]"
          style={{ width: `${porcentajeDeProgreso(hechas, total)}%` }}
        />
      </div>
    </div>
  );
}
