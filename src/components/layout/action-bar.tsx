import React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface ActionBarProps {
  breadcrumb: string;
  children?: React.ReactNode;
}

export function ActionBar({ breadcrumb, children }: ActionBarProps) {
  return (
    <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-6 py-2 xl:px-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Gestión</span>
        <ChevronRight size={14} className="text-ink-muted" />
        <span aria-current="page" className="font-medium text-ink-soft">
          {breadcrumb}
        </span>
      </nav>
      <div className="flex flex-wrap items-center gap-3 xl:gap-4">{children}</div>
    </div>
  );
}

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "accent";
  disabled?: boolean;
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
}: ActionButtonProps) {
  const color = variant === "accent" ? "text-brand-strong" : "text-ink-soft";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium ${color} ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-hover"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
