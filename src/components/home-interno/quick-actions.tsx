"use client";

import React from "react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";
import { ClipboardList, CreditCard, DoorOpen, UserPlus, type LucideIcon } from "lucide-react";

/**
 * Row_Acciones — exactly 4 equal-width quick-action buttons, literal labels,
 * no zone title (spec AC-001). The caller decides what each action does.
 */
export type QuickAction = "nuevo-socio" | "registrar-pago" | "asignar-rutina" | "control-acceso";

const ACTIONS: { key: QuickAction; label: string; icon: LucideIcon }[] = [
  { key: "nuevo-socio", label: "Nuevo Socio", icon: UserPlus },
  { key: "registrar-pago", label: "Registrar Pago", icon: CreditCard },
  { key: "asignar-rutina", label: "Asignar Rutina", icon: ClipboardList },
  { key: "control-acceso", label: "Control Acceso", icon: DoorOpen },
];

export interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
  /** Actions the role cannot use: still rendered (AC-001) but disabled. */
  disabledActions?: QuickAction[];
}

export function QuickActions({ onAction, disabledActions = [] }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-4 gap-6">
      {ACTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onAction(key)}
          disabled={disabledActions.includes(key)}
          title={disabledActions.includes(key) ? SIN_ACCESO_TITLE : undefined}
          className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-4 text-sm font-bold text-zinc-900 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
