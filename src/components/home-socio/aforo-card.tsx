"use client";

import React from "react";

/**
 * Aforo — Live occupancy chart for Fila1 of Home_Socio.
 * Matches openspec/../Home_Socio_1x design: an hourly bar chart (06h–22h)
 * with the current hour highlighted, not a single percentage figure.
 *
 * SCHEMA GAP (documented): building the real per-hour histogram needs
 * aggregated Asistencia counts by hour bucket, which has no repository yet
 * (see src/domains/home-socio/home-socio.ts header note). `horas` is
 * therefore supplied by the caller; this component only renders it.
 */
export interface HoraOcupacion {
  hora: number; // 0-23
  ocupacion: number;
}

export interface AforoCardProps {
  ocupacionActual: number;
  capacidadMaxima: number;
  horas: HoraOcupacion[];
  horaActual: number;
}

export function AforoCard({
  ocupacionActual,
  capacidadMaxima,
  horas,
  horaActual,
}: AforoCardProps) {
  if (!capacidadMaxima || capacidadMaxima <= 0) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
        Aforo no configurado
      </div>
    );
  }

  const maxOcupacion = Math.max(1, ...horas.map((h) => h.ocupacion));

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6">
      <p className="text-sm font-medium text-zinc-600">Aforo actual:</p>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full border-2 border-green-700 bg-neutral-300" />
        <p className="text-xl font-bold text-zinc-900">
          {ocupacionActual} / {capacidadMaxima}
        </p>
      </div>
      <p className="text-xs text-zinc-500">
        Basado en ingresos de los últimos 90 min
      </p>

      <div className="flex h-40 items-end gap-2">
        {horas.map((h) => (
          <div
            key={h.hora}
            data-testid="aforo-bar"
            data-hora={h.hora}
            data-current={h.hora === horaActual ? "true" : "false"}
            title={`${h.hora}h: ${h.ocupacion}`}
            className={`w-full grow rounded-t-sm ${
              h.hora === horaActual ? "bg-[#FF6B00]" : "bg-zinc-200"
            }`}
            style={{ height: `${(h.ocupacion / maxOcupacion) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400">
        {horas.map((h) => (
          <span key={h.hora}>{h.hora}h</span>
        ))}
      </div>
    </div>
  );
}
