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
      <div
        data-testid="card-aforo"
        className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted"
      >
        Aforo no configurado
      </div>
    );
  }

  const maxOcupacion = Math.max(1, ...horas.map((h) => h.ocupacion));

  return (
    <div
      data-testid="card-aforo"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
    >
      <p className="text-sm font-medium text-ink-muted">Aforo actual:</p>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full border-2 border-success bg-neutral-300" />
        <p className="text-xl font-bold text-ink">
          {ocupacionActual} / {capacidadMaxima}
        </p>
      </div>
      <p className="text-xs text-ink-muted">
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
              h.hora === horaActual ? "bg-brand" : "bg-surface-active"
            }`}
            style={{ height: `${(h.ocupacion / maxOcupacion) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-overline text-ink-disabled">
        {horas.map((h) => (
          <span key={h.hora}>{h.hora}h</span>
        ))}
      </div>
    </div>
  );
}
