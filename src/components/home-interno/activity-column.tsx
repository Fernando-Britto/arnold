"use client";

import React from "react";
import { formatHaceTiempo, type ActivityItemView } from "@/domains/home-interno/home-interno";

// Kept as re-exports: both used to live here (T-020) and callers import them from this module.
export { formatHaceTiempo };
export type { ActivityItemView };

/**
 * Col_Actividad — recent activity feed for Home_Interno.
 * Matches Home_Interno design. Expects already-filtered/formatted items —
 * the filtering rule (5 event types, no check-ins, last 24h) lives in
 * filterActivityFeed (src/domains/home-interno/home-interno.ts), and the
 * "Hace X" formatting lives in formatHaceTiempo (same module); both are composed
 * by aggregateHomeInterno before items reach this component.
 */
export interface ActivityColumnProps {
  items: ActivityItemView[];
  /** Cada fila lleva a la sección donde se resuelve (pagos o clientes). */
  onSelect?: (item: ActivityItemView) => void;
}

/** Una anulación de pago es una excepción, no un movimiento más: se destaca. */
const esAnulacion = (item: ActivityItemView) => item.tipo === "ANULACION_PAGO";

export function ActivityColumn({ items, onSelect }: ActivityColumnProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <p className="text-meta font-bold text-ink">Últimos movimientos</p>

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin movimientos en las últimas 24 horas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(item)}
              disabled={!onSelect}
              className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left enabled:hover:bg-surface-hover disabled:cursor-default"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-meta font-medium text-ink-muted">{item.nombre}</span>
                <span aria-hidden="true" className="text-meta text-ink-disabled">•</span>
                <span
                  className={`truncate text-meta ${esAnulacion(item) ? "font-bold text-danger" : "text-ink-muted"}`}
                >
                  {item.descripcion}
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink-disabled">{item.haceTexto}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
