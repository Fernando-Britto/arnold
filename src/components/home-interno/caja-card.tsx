"use client";

import React from "react";

/**
 * Row_Hoy · Caja (AC-004). Totals come from computeCajaHoy (Efectivo + Transferencia + Tarjeta). The "Cierre de
 * Caja" flow itself (creates CierreDeCaja on confirm) is NOT part of T-021a —
 * this card only exposes the trigger.
 */
export interface CajaCardProps {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  total: number;
  onCierreDeCaja: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function CajaCard({ efectivo, transferencia, tarjeta, total, onCierreDeCaja }: CajaCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-zinc-500">Caja de hoy</p>
      <p data-testid="caja-total" className="text-3xl font-bold text-zinc-900">
        {money(total)}
      </p>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Efectivo</span>
        <span>{money(efectivo)}</span>
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Transferencia</span>
        <span>{money(transferencia)}</span>
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Tarjeta</span>
        <span>{money(tarjeta)}</span>
      </div>
      <button
        type="button"
        onClick={onCierreDeCaja}
        className="mt-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
      >
        Cierre de Caja
      </button>
    </div>
  );
}
