"use client";

import React from "react";

/**
 * Row_Hoy · Aforo (staff view). Distinct from home-socio's AforoCard because
 * the spec requires "N / capacidad miembros" AND a percentage (AC-003), plus
 * the capped-at-100% edge case. Values come from computeAforo.
 */
export interface AforoHoyCardProps {
  ocupacionActual: number;
  capacidadMaxima: number;
  porcentaje: number;
  horas: { hora: number; ocupacion: number }[];
  horaActual: number;
}

export function AforoHoyCard({
  ocupacionActual,
  capacidadMaxima,
  porcentaje,
  horas,
  horaActual,
}: AforoHoyCardProps) {
  if (capacidadMaxima <= 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center text-zinc-500">
        Aforo no configurado
      </div>
    );
  }

  const max = Math.max(1, ...horas.map((h) => h.ocupacion));

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-zinc-900">Aforo actual</p>
        <p className="text-sm font-bold text-emerald-600">{porcentaje}%</p>
      </div>
      <p className="text-sm text-zinc-600">
        {ocupacionActual} / {capacidadMaxima} miembros
      </p>
      <div className="flex h-24 items-end gap-2">
        {horas.map((h) => (
          <div
            key={h.hora}
            data-testid="aforo-bar"
            data-current={h.hora === horaActual ? "true" : "false"}
            title={`${h.hora}h: ${h.ocupacion}`}
            className={`w-full grow rounded-t-sm ${h.hora === horaActual ? "bg-blue-600" : "bg-zinc-200"}`}
            style={{ height: `${(h.ocupacion / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400">
        {horas.map((h) => (
          <span key={h.hora}>{String(h.hora).padStart(2, "0")}h</span>
        ))}
      </div>
    </div>
  );
}
