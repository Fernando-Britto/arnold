"use client";

import React from "react";
import { computeMembresiaStatus } from "@/domains/home-socio/home-socio";

/**
 * Membresia — plan status + "Últimas 4 semanas" attendance widget, Fila3 of
 * Home_Socio. Matches Home_Socio_1x design.
 */
export interface MembresiaCardProps {
  planNombre: string;
  fechaVencimiento: Date;
  /** Length of the current billing cycle, in days (e.g. 30). */
  diasTotalMembresia: number;
  /** Injected for deterministic tests; defaults to `new Date()`. */
  hoy?: Date;
  /** 28-length grid from compute28DiasAsistencia (4 weeks × 7 days). */
  dias28: boolean[];
  totalAsistencias: number;
  onVerMembresia?: () => void;
  onRenovar?: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
  AL_DIA: "Al día",
  POR_VENCER: "Por vencer",
  VENCIDA: "Vencida",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaLarga(fecha: Date): string {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}, ${fecha.getUTCFullYear()}`;
}

const DIAS_LABEL = ["L", "M", "X", "J", "V", "S", "D"];

export function MembresiaCard({
  planNombre,
  fechaVencimiento,
  diasTotalMembresia,
  hoy = new Date(),
  dias28,
  totalAsistencias,
  onVerMembresia,
  onRenovar,
}: MembresiaCardProps) {
  const { diasRestantes, estado, mostrarRenovar } = computeMembresiaStatus(
    fechaVencimiento,
    hoy
  );
  const diasRestantesClamped = Math.max(diasRestantes, 0);
  const fillPercent = Math.min(
    100,
    Math.max(0, (diasRestantesClamped / diasTotalMembresia) * 100)
  );

  const badgeClass =
    estado === "AL_DIA"
      ? "bg-green-100 text-green-800"
      : estado === "POR_VENCER"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="flex items-center justify-between gap-6 rounded-3xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xl font-bold text-zinc-900">{planNombre}</p>
          <span
            className={`rounded-sm px-2.5 py-1 text-xs font-bold ${badgeClass}`}
          >
            {ESTADO_LABEL[estado]}
          </span>
        </div>
        <p className="text-sm text-zinc-600">
          Vencimiento: {formatFechaLarga(fechaVencimiento)}
        </p>
        <div className="flex w-80 flex-col gap-2">
          <p className="text-xs text-zinc-500">
            Quedan {diasRestantesClamped} de {diasTotalMembresia} días
          </p>
          <div className="h-1 w-80 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-[#FC4C02]"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onVerMembresia}
            className="rounded-lg border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-500"
          >
            Ver membresía
          </button>
          {mostrarRenovar && (
            <button
              type="button"
              onClick={onRenovar}
              className="rounded-lg bg-[#FC4C02] px-5 py-3 text-sm font-bold text-white"
            >
              Renovar ahora
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-zinc-500">Últimas 4 semanas</p>
          <p className="text-4xl font-bold text-[#FC4C02]">{totalAsistencias}</p>
          <p className="text-xs text-zinc-500">Asistencias totales</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            {DIAS_LABEL.map((l) => (
              <p key={l} className="w-3 text-center text-[10px] text-zinc-500">
                {l}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2, 3].map((fila) => (
              <div key={fila} className="flex gap-3">
                {DIAS_LABEL.map((_, col) => {
                  const filled = dias28[fila * 7 + col];
                  return (
                    <span
                      key={col}
                      data-testid="dia-dot"
                      data-filled={filled ? "true" : "false"}
                      className={`h-2 w-2 rounded-full ${
                        filled ? "bg-[#FC4C02]" : "bg-zinc-200"
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
