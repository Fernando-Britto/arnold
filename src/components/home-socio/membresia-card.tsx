"use client";

import React from "react";
import { computeMembresiaStatus } from "@/domains/home-socio/home-socio";
import { toGymWallClock } from "@/lib/gym-time";

/**
 * Membresia — plan status + "Últimas 4 semanas" attendance widget, Fila3 of
 * Home_Socio. Matches Home_Socio_1x design.
 */
export interface MembresiaCardProps {
  /** Plan name, or null when the Socio has no membership (renders the empty state). */
  planNombre: string | null;
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
  // Formatear en la hora de pared del gimnasio (UTC-3): un instante como
  // 2026-11-01T00:00:00Z cae el 31/10 en el gimnasio, no el 1/11 (NEW-1).
  const gym = toGymWallClock(fecha);
  return `${gym.getUTCDate()} de ${MESES[gym.getUTCMonth()]}, ${gym.getUTCFullYear()}`;
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
  if (!planNombre) {
    return (
      <div
        data-testid="card-membresia"
        className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted"
      >
        Sin membresía asignada
      </div>
    );
  }

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
      ? "bg-success-soft text-success"
      : estado === "POR_VENCER"
        ? "bg-warning-soft text-warning"
        : "bg-danger-soft text-danger";

  return (
    <div
      data-testid="card-membresia"
      className="flex items-center justify-between gap-6 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xl font-bold text-ink">{planNombre}</p>
          <span
            className={`rounded-sm px-2.5 py-1 text-xs font-bold ${badgeClass}`}
          >
            {ESTADO_LABEL[estado]}
          </span>
        </div>
        <p className="text-sm text-ink-muted">
          Vencimiento: {formatFechaLarga(fechaVencimiento)}
        </p>
        <div className="flex w-80 flex-col gap-2">
          <p className="text-xs text-ink-muted">
            Quedan {diasRestantesClamped} de {diasTotalMembresia} días
          </p>
          <div className="h-1 w-80 overflow-hidden rounded-full bg-surface-subtle">
            <div
              className="h-full bg-brand"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onVerMembresia}
            className="rounded-lg border border-border px-5 py-3 text-sm font-bold text-ink-muted"
          >
            Ver membresía
          </button>
          {mostrarRenovar && (
            <button
              type="button"
              onClick={onRenovar}
              className="rounded-lg bg-brand-strong px-5 py-3 text-sm font-bold text-surface"
            >
              Renovar ahora
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-ink-muted">Últimas 4 semanas</p>
          <p className="text-4xl font-bold text-brand">{totalAsistencias}</p>
          <p className="text-xs text-ink-muted">Asistencias totales</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            {DIAS_LABEL.map((l) => (
              <p key={l} className="w-3 text-center text-overline text-ink-muted">
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
                        filled ? "bg-brand" : "bg-surface-active"
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
