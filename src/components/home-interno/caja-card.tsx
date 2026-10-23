"use client";

import React from "react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";
import { formatMoney as money } from "@/utils/formatting";

/**
 * Row_Hoy · Caja (AC-004). Totals come from computeCajaHoy (Efectivo + Transferencia + Tarjeta). The "Cierre de
 * Caja" flow itself lives at /cierres (T-040); this card only exposes the trigger,
 * rendered-but-disabled for roles that cannot open it.
 */
export interface CajaCardProps {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  total: number;
  onCierreDeCaja: () => void;
  /** true when the current role cannot open /cierres. */
  cierreDisabled?: boolean;
}

export function CajaCard({
  efectivo,
  transferencia,
  tarjeta,
  total,
  onCierreDeCaja,
  cierreDisabled = false,
}: CajaCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
      <p className="text-sm font-medium text-ink-muted">Caja de hoy</p>
      <p data-testid="caja-total" className="text-3xl font-bold text-ink">
        {money(total)}
      </p>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Efectivo</span>
        <span>{money(efectivo)}</span>
      </div>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Transferencia</span>
        <span>{money(transferencia)}</span>
      </div>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>Tarjeta</span>
        <span>{money(tarjeta)}</span>
      </div>
      <button
        type="button"
        onClick={onCierreDeCaja}
        disabled={cierreDisabled}
        title={cierreDisabled ? SIN_ACCESO_TITLE : undefined}
        className="mt-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cierre de Caja
      </button>
    </div>
  );
}
