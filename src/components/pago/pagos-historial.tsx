"use client";

import React, { useEffect, useState } from "react";
import {
  anularPago,
  fetchPagosDeSocio,
  type PagoHistorial,
} from "@/api/pagos";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";
import { formatMoney } from "@/utils/formatting";

const ESTADO_LABEL: Record<PagoHistorial["estado"], string> = {
  CONFIRMADO: "Confirmado",
  PENDIENTE: "Pendiente",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<PagoHistorial["estado"], BadgeVariant> = {
  CONFIRMADO: "success",
  PENDIENTE: "warning",
  ANULADO: "danger",
};

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Historial de pagos de un socio con la acción de anular (P-39). Pide el motivo, confirma y
 * refresca la lista al anular. Los pagos ya ANULADO no ofrecen la acción.
 */
export interface PagosHistorialProps {
  socioId: string;
  /** Se llama tras anular con éxito (para que quien lo use refresque lo que muestre). */
  onAnulado?: () => void;
}

export function PagosHistorial({ socioId, onAnulado }: PagosHistorialProps) {
  const { notify } = useNotifications();
  const [pagos, setPagos] = useState<PagoHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    try {
      setPagos(await fetchPagosDeSocio(socioId));
      setError(null);
    } catch (err) {
      setError(handleApiError(err, "No se pudo cargar el historial de pagos."));
    }
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await fetchPagosDeSocio(socioId);
        if (cancelado) return;
        setPagos(data);
        setError(null);
      } catch (err) {
        if (!cancelado) setError(handleApiError(err, "No se pudo cargar el historial de pagos."));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [socioId]);

  const cancelar = () => {
    setAnulandoId(null);
    setMotivo("");
    setError(null);
  };

  const confirmarAnulacion = async (pago: PagoHistorial) => {
    if (motivo.trim() === "") {
      setError("El motivo es obligatorio.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await anularPago(pago.id, motivo.trim());
      notify("success", "Pago anulado.");
      cancelar();
      await cargar();
      onAnulado?.();
    } catch (err) {
      setError(handleApiError(err, "No se pudo anular el pago."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      aria-labelledby="pagos-historial-titulo"
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h3 id="pagos-historial-titulo" className="text-base font-semibold text-zinc-900">
        Historial de pagos
      </h3>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {pagos === null ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay pagos registrados.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="pb-2 font-medium">Fecha</th>
              <th className="pb-2 font-medium">Método</th>
              <th className="pb-2 text-right font-medium">Monto</th>
              <th className="pb-2 font-medium">Estado</th>
              <th className="pb-2 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagos.map((pago) => (
              <tr key={pago.id} data-testid="pago-historial">
                <td className="py-2 text-zinc-700">{formatFecha(pago.fechaPago)}</td>
                <td className="py-2 text-zinc-700">
                  {METODO_LABEL[pago.metodoPago] ?? pago.metodoPago}
                </td>
                <td className="py-2 text-right font-medium text-zinc-900">
                  {formatMoney(pago.monto)}
                </td>
                <td className="py-2">
                  <Badge variant={ESTADO_VARIANT[pago.estado]}>
                    {ESTADO_LABEL[pago.estado]}
                  </Badge>
                </td>
                <td className="py-2 text-right">
                  {pago.estado === "ANULADO" ? null : anulandoId === pago.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <label htmlFor={`motivo-${pago.id}`} className="sr-only">
                        Motivo de la anulación
                      </label>
                      <input
                        id={`motivo-${pago.id}`}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Motivo"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmarAnulacion(pago)}
                          disabled={enviando}
                          className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                          {enviando ? "Anulando…" : "Confirmar"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelar}
                          disabled={enviando}
                          className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMotivo("");
                        setAnulandoId(pago.id);
                      }}
                      className="rounded border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
