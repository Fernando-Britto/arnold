"use client";

import React from "react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";

/**
 * Row_Hoy · Alertas (860px column). Items are already derived by
 * computeAlertasVencimiento; this component only renders them.
 * Spec edge case: zero alerts shows an empty-state message, not a blank area.
 */
export interface AlertaItemView {
  socioId: string;
  texto: string;
  detalle: string;
}

export interface AlertasCardProps {
  items: AlertaItemView[];
  onVer: (socioId: string) => void;
  /** The role cannot open the destination of "Ver". */
  verDisabled?: boolean;
}

export function AlertasCard({ items, onVer, verDisabled = false }: AlertasCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <p className="text-base font-bold text-ink">Alertas críticas</p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin alertas por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.socioId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-warning-soft0" aria-hidden="true" />
                <span className="text-sm text-ink-soft">{item.texto}</span>
                <span className="text-xs text-ink-disabled">{item.detalle}</span>
              </div>
              <button
                type="button"
                onClick={() => onVer(item.socioId)}
                disabled={verDisabled}
                title={verDisabled ? SIN_ACCESO_TITLE : undefined}
                className="text-sm font-medium text-info disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ver →
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
