"use client";

import React, { useEffect, useState } from "react";
import {
  fetchCierres,
  type CierreDeCajaResumenDTO,
  type PagoDeCierreDTO,
} from "@/api/cierres";
import { handleApiError } from "@/utils/api-error";
import { formatMoney as money } from "@/utils/formatting";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableDetailRow,
  type TableColumn,
} from "@/components/ui/table";
import { formatFechaCierre, formatHoraCierre } from "./fechas";

export interface HistorialCierresProps {
  /** Cambia cuando se registra un cierre: vuelve a pedir la primera página. */
  refrescarToken?: number;
}

const PAGE_SIZE = 10;

const COLUMNS: TableColumn[] = [
  { key: "fecha", label: "Fecha" },
  { key: "total", label: "Total", width: 140, align: "right" },
  { key: "efectivo", label: "Efectivo", width: 120, align: "right" },
  { key: "transferencia", label: "Transferencia", width: 130, align: "right" },
  { key: "tarjeta", label: "Tarjeta", width: 110, align: "right" },
  { key: "operaciones", label: "Operaciones", width: 110, align: "right" },
];

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

function metodoLabel(metodo: string): string {
  return METODO_LABEL[metodo] ?? metodo;
}

function cobros(pagos: PagoDeCierreDTO[]) {
  return pagos.map((pago) => (
    <li
      key={pago.id}
      className="flex items-center justify-between gap-3 tabular-nums"
    >
      <span>
        {formatHoraCierre(pago.fechaPago)} · {metodoLabel(pago.metodoPago)}
      </span>
      <span className="font-medium text-ink-soft">{money(pago.monto)}</span>
    </li>
  ));
}

/**
 * Historial de cierres: tabla paginada server-side con fila seleccionable que despliega
 * el detalle de las operaciones incluidas. Sin acciones de edición ni eliminación.
 */
export function HistorialCierres({ refrescarToken }: HistorialCierresProps) {
  const [pagina, setPagina] = useState(0);
  const [items, setItems] = useState<CierreDeCajaResumenDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    fetchCierres({ limit: PAGE_SIZE, offset: pagina * PAGE_SIZE })
      .then((data) => {
        if (cancelado) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(handleApiError(err, "No se pudieron cargar los cierres."));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [pagina, reintento, refrescarToken]);

  const irAPagina = (nueva: number) => {
    if (nueva < 0) return;
    setSeleccionadoId(null);
    setError(null);
    setCargando(true);
    setPagina(nueva);
  };

  const reintentar = () => {
    setError(null);
    setCargando(true);
    setReintento((n) => n + 1);
  };

  const desde = items.length === 0 ? 0 : pagina * PAGE_SIZE + 1;
  const hasta = pagina * PAGE_SIZE + items.length;
  const hayAnterior = pagina > 0;
  const haySiguiente = hasta < total;

  return (
    <section
      aria-labelledby="historial-cierres-titulo"
      className="w-full rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="historial-cierres-titulo" className="text-xl font-semibold text-ink">
        Historial de cierres
      </h2>

      <div className="mt-4" data-testid="historial-cierres">
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-soft bg-danger-soft p-3 text-sm text-danger">
            <span>{error}</span>
            <button
              type="button"
              onClick={reintentar}
              className="rounded border border-danger px-3 py-1 font-semibold text-danger hover:bg-surface"
            >
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          cargando ? (
            <p role="status" className="text-sm text-ink-muted">
              Cargando historial…
            </p>
          ) : (
            <p className="text-sm text-ink-muted">Todavía no hay cierres registrados.</p>
          )
        ) : (
          <Table label="Historial de cierres">
            <TableHeader columns={COLUMNS} disclosure />
            {items.map((cierre) => {
              const abierto = cierre.id === seleccionadoId;
              return (
                <React.Fragment key={cierre.id}>
                  <TableRow
                    selected={abierto}
                    onClick={() => setSeleccionadoId(abierto ? null : cierre.id)}
                    disclosure
                  >
                    <TableCell>{formatFechaCierre(cierre.createdAt)}</TableCell>
                    <TableCell width={140} align="right">
                      <span className="tabular-nums">{money(cierre.totalRecaudado)}</span>
                    </TableCell>
                    <TableCell width={120} align="right">
                      <span className="tabular-nums">{money(cierre.totalEfectivo)}</span>
                    </TableCell>
                    <TableCell width={130} align="right">
                      <span className="tabular-nums">{money(cierre.totalTransferencia)}</span>
                    </TableCell>
                    <TableCell width={110} align="right">
                      <span className="tabular-nums">{money(cierre.totalTarjeta)}</span>
                    </TableCell>
                    <TableCell width={110} align="right">
                      <span className="tabular-nums">{cierre.cantidadOperaciones}</span>
                    </TableCell>
                  </TableRow>
                  {abierto && (
                    <TableDetailRow>
                      <div>
                        <p className="text-overline font-bold uppercase text-brand-strong">
                          Fecha y hora
                        </p>
                        <p className="text-sm text-ink-soft">
                          {formatFechaCierre(cierre.createdAt, true)}
                        </p>
                      </div>
                      <div>
                        <p className="text-overline font-bold uppercase text-brand-strong">
                          Operaciones
                        </p>
                        <p className="text-sm text-ink-soft">
                          {cierre.cantidadOperaciones} operaciones
                        </p>
                      </div>
                      <div>
                        <p className="text-overline font-bold uppercase text-brand-strong">
                          Operaciones incluidas
                        </p>
                        {cierre.pagos.length === 0 ? (
                          <p className="text-sm text-ink-soft">
                            Este cierre no incluyó operaciones.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                            {cobros(cierre.pagos)}
                          </ul>
                        )}
                      </div>
                    </TableDetailRow>
                  )}
                </React.Fragment>
              );
            })}
          </Table>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
          <p className="tabular-nums">
            Mostrando {desde}–{hasta} de {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => irAPagina(pagina - 1)}
              disabled={!hayAnterior}
              aria-label="Anterior"
              className="rounded border border-border px-3 py-1 font-semibold text-ink-soft hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => irAPagina(pagina + 1)}
              disabled={!haySiguiente}
              aria-label="Siguiente"
              className="rounded border border-border px-3 py-1 font-semibold text-ink-soft hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
