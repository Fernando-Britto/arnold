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
    <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6">
      <p className="text-base font-bold text-zinc-900">Alertas críticas</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin alertas por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.socioId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="text-sm text-zinc-700">{item.texto}</span>
                <span className="text-xs text-zinc-400">{item.detalle}</span>
              </div>
              <button
                type="button"
                onClick={() => onVer(item.socioId)}
                disabled={verDisabled}
                title={verDisabled ? SIN_ACCESO_TITLE : undefined}
                className="text-sm font-medium text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
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
