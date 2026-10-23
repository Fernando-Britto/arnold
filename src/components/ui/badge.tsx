import React from "react";

export type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

/**
 * Misma paleta de estados que `TableStatusBadge` (table.tsx). Antes este componente
 * usaba la escala de Tailwind (green-100/red-100/amber-100/blue-100) y el de tabla
 * hex crudos: dos lenguajes de color para el mismo concepto. Ahora salen de los
 * tokens de estado y un cambio en globals.css mueve ambos.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-subtle text-ink-soft",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-bold ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
