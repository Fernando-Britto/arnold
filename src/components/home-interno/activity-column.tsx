"use client";

import React from "react";

/**
 * Col_Actividad — recent activity feed for Home_Interno.
 * Matches Home_Interno design. Expects already-filtered/formatted items —
 * the filtering rule (5 event types, no check-ins, last 24h) lives in
 * filterActivityFeed (src/domains/home-interno/home-interno.ts), and the
 * "Hace X" formatting lives in formatHaceTiempo below, so the caller
 * (T-021b page) composes both before passing items here.
 */
export interface ActivityItemView {
  nombre: string;
  descripcion: string;
  haceTexto: string;
}

export interface ActivityColumnProps {
  items: ActivityItemView[];
}

/** Renders a Date as "Hace N min" / "Hace 1 hora" / "Hace N horas" /
 * "Hace unos segundos", relative to `hoy`. */
export function formatHaceTiempo(fecha: Date, hoy: Date): string {
  const segundos = Math.floor((hoy.getTime() - fecha.getTime()) / 1000);
  if (segundos < 60) return "Hace unos segundos";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas === 1 ? "Hace 1 hora" : `Hace ${horas} horas`;
}

export function ActivityColumn({ items }: ActivityColumnProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5">
      <p className="text-[13px] font-bold text-zinc-900">Últimos movimientos</p>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin movimientos en las últimas 24 horas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-zinc-500">{item.nombre}</p>
                <span className="text-[13px] text-zinc-400">•</span>
                <p className="text-[13px] text-zinc-500">{item.descripcion}</p>
              </div>
              <p className="text-xs text-zinc-400">{item.haceTexto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
