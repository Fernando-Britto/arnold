"use client";

import React from "react";

/**
 * Row_Gestion counter card: label + live count (24px bold), clickable to the
 * matching CRUD list. `disabled` is for roles that cannot open that section
 * (see ROLE_GATE_MATRIX); the card still renders so the zone keeps its 4 cards.
 */
export interface CounterCardProps {
  label: string;
  /** Pre-formatted count, e.g. "124". */
  metric: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function CounterCard({ label, metric, onClick, disabled = false }: CounterCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Sin acceso con tu rol" : undefined}
      className="flex w-full flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5 text-left enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-sm font-medium text-zinc-500">{label}</span>
      <span className="text-2xl font-bold text-zinc-900">{metric}</span>
    </button>
  );
}
