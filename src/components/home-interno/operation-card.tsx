"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";

/**
 * OperationCard — reusable status card for Row_Operacion (Estado de
 * equipos / Personal en turno / Socios inactivos).
 * Matches Home_Interno design: label + big metric on the left, icon in a
 * gray rounded box on the right, footer caption below. The whole card is
 * clickable (spec: "each clickable to a filtered detail view").
 */
export interface OperationCardProps {
  label: string;
  /** Pre-formatted, e.g. "98%", "6", "42". */
  metric: string;
  footer: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** The role cannot open the destination. */
  disabled?: boolean;
}

export function OperationCard({ label, metric, footer, icon: Icon, onClick, disabled = false }: OperationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? SIN_ACCESO_TITLE : undefined}
      className="flex w-full flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-5 text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="text-2xl font-bold text-zinc-900">{metric}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
          <Icon className="h-5 w-5 text-zinc-900" aria-hidden="true" />
        </div>
      </div>
      <p className="text-xs text-zinc-400">{footer}</p>
    </button>
  );
}
