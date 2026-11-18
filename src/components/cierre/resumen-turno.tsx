"use client";

import React from "react";
import type { PreviewCierreResult } from "@/api/cierres";
import { formatMoney as money } from "@/utils/formatting";
import { formatFechaCierre } from "./fechas";

export interface ResumenTurnoProps {
  totales: PreviewCierreResult | null;
  cargando: boolean;
  error: string | null;
  confirmando: boolean;
  onConfirmar: () => void;
  onReintentar: () => void;
}

interface FilaDesgloseProps {
  label: string;
  valor: number;
  destacada?: boolean;
}

function FilaDesglose({ label, valor, destacada = false }: FilaDesgloseProps) {
  return (
    <div
      className={`flex items-center justify-between ${
        destacada ? "mt-2 border-t border-border pt-2 font-semibold text-ink" : ""
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{money(valor)}</dd>
    </div>
  );
}

/**
 * Panel presentacional del turno: fecha, total con la mayor jerarquía, operaciones
 * pendientes y desglose por método. No ejecuta el cierre: sólo avisa la intención.
 */
export function ResumenTurno({
  totales,
  cargando,
  error,
  confirmando,
  onConfirmar,
  onReintentar,
}: ResumenTurnoProps) {
  const sinOperaciones = Boolean(totales && totales.cantidadOperaciones === 0);

  return (
    <section
      aria-labelledby="cierre-turno-titulo"
      className="w-full rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="cierre-turno-titulo" className="text-xl font-semibold text-ink">
        Cierre del turno actual
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Fecha del turno:{" "}
        <span className="font-medium text-ink-soft">
          {totales ? formatFechaCierre(totales.desde) : "—"}
        </span>
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-soft bg-danger-soft p-3 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onReintentar}
            className="rounded border border-danger px-3 py-1 font-semibold text-danger hover:bg-surface"
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando && !totales ? (
        <p role="status" className="mt-4 text-sm text-ink-muted">
          Cargando el resumen…
        </p>
      ) : totales ? (
        <>
          <div className="mt-4">
            <p className="text-sm font-medium text-ink-muted">Total recaudado</p>
            <p data-testid="cierre-total" className="text-4xl font-bold text-ink">
              {money(totales.totalRecaudado)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {totales.cantidadOperaciones} operaciones pendientes de cierre
            </p>
          </div>

          {sinOperaciones && (
            <p role="status" className="mt-3 text-sm text-ink-muted">
              No hay operaciones pendientes en este turno.
            </p>
          )}

          <dl className="mt-5 flex flex-col gap-2 text-sm text-ink-muted">
            <FilaDesglose label="Efectivo" valor={totales.totalEfectivo} />
            <FilaDesglose label="Transferencia" valor={totales.totalTransferencia} />
            <FilaDesglose label="Tarjeta" valor={totales.totalTarjeta} />
            <FilaDesglose label="Total" valor={totales.totalRecaudado} destacada />
          </dl>
        </>
      ) : null}

      <button
        type="button"
        onClick={onConfirmar}
        disabled={confirmando || cargando || !totales || sinOperaciones}
        className="mt-6 rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
      >
        {confirmando ? "Cerrando…" : "Confirmar cierre"}
      </button>
    </section>
  );
}
