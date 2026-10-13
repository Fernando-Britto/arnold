"use client";

import React from "react";
import { CreditCard } from "lucide-react";
import type { MembresiaSeccionDTO } from "@/api/home-socio-secciones";

/**
 * PagosSection (T-039, D-45): historial de pagos, cobertura/vencimiento y estado de pago
 * calculado (`estadoCuotaSocio`, D-40). Los datos salen de `/api/home-socio/secciones`:
 * un SOCIO no tiene acceso a `/api/pagos` (T-032).
 */
export interface PagosSectionProps {
  membresia: MembresiaSeccionDTO | null;
}

const ESTADO_LABEL: Record<string, string> = {
  AL_DIA: "Al día",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
  SIN_CUOTA: "Sin cuota",
};

const ESTADO_CLASS: Record<string, string> = {
  AL_DIA: "bg-green-100 text-green-800",
  PENDIENTE: "bg-amber-100 text-amber-800",
  VENCIDA: "bg-red-100 text-red-800",
  SIN_CUOTA: "bg-zinc-100 text-zinc-700",
};

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

const montoFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function formatPeriodo(periodo: string | null): string {
  if (!periodo) return "—";
  const [y, m] = periodo.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function PagosSection({ membresia }: PagosSectionProps) {
  return (
    <section aria-labelledby="pagos-titulo" className="flex flex-col gap-6">
      <h1 id="pagos-titulo" className="text-xl font-bold text-zinc-900">
        Mis pagos y membresía
      </h1>

      {!membresia ? (
        <p className="text-sm text-zinc-500">Todavía no tenés pagos ni membresía registrados.</p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white p-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-[#FC4C02]" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="font-bold text-zinc-900">
                  {membresia.planNombre ?? "Sin plan asignado"}
                </span>
                <span className="text-sm text-zinc-500">
                  {membresia.fechaVencimiento
                    ? `Cubierto hasta el ${formatFecha(membresia.fechaVencimiento)}`
                    : "Sin cobertura registrada"}
                </span>
              </div>
            </div>
            <span
              data-testid="estado-pago"
              className={`rounded-sm px-2.5 py-1 text-xs font-bold ${
                ESTADO_CLASS[membresia.estado] ?? "bg-zinc-100 text-zinc-700"
              }`}
            >
              {ESTADO_LABEL[membresia.estado] ?? membresia.estado}
            </span>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-[#E4E4E7] bg-white p-6">
            <h2 className="text-lg font-bold text-zinc-900">Historial de pagos</h2>
            {membresia.historial.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavía no registraste pagos.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Período</th>
                    <th className="pb-2 font-medium">Método</th>
                    <th className="pb-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {membresia.historial.map((p) => (
                    <tr key={p.id} data-testid="pago-historial">
                      <td className="py-2 text-zinc-700">{formatFecha(p.fechaPago)}</td>
                      <td className="py-2 capitalize text-zinc-700">{formatPeriodo(p.periodo)}</td>
                      <td className="py-2 text-zinc-700">{METODO_LABEL[p.metodoPago] ?? p.metodoPago}</td>
                      <td className="py-2 text-right font-medium text-zinc-900">
                        {montoFormatter.format(p.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
