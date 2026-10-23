"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";

/**
 * Estado operativo: etiqueta, métrica, pie y un ícono de referencia.
 *
 * Igual que `CounterCard`, dejó de ser una tarjeta con borde y fondo: formaba parte de
 * una fila de tarjetas idénticas que competían visualmente con las señales del día.
 * Ahora es una métrica en línea; el contenedor que la agrupa vive en la página.
 */
export interface OperationCardProps {
  label: string;
  /** Pre-formatted, e.g. "98%", "6", "42". */
  metric: string;
  footer: string;
  /** Segunda línea del pie; no se renderiza si es null. */
  nota?: string | null;
  icon: LucideIcon;
  onClick?: () => void;
  /** The role cannot open the destination. */
  disabled?: boolean;
}

export function OperationCard({ label, metric, footer, nota, icon: Icon, onClick, disabled = false }: OperationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? SIN_ACCESO_TITLE : undefined}
      className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-meta font-medium text-ink-muted">{label}</span>
        <span className="text-xl font-bold text-ink">{metric}</span>
        <span className="text-xs text-ink-disabled">{footer}</span>
        {nota && <span className="text-xs font-medium text-warning">{nota}</span>}
      </span>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-disabled" aria-hidden="true" />
    </button>
  );
}
