import React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface ActionBarProps {
  breadcrumb: string;
  children?: React.ReactNode;
}

export function ActionBar({ breadcrumb, children }: ActionBarProps) {
  return (
    <div className="flex h-[72px] items-center justify-between px-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <span className="text-[#999999]">Gestión</span>
        <ChevronRight size={14} className="text-[#999999]" />
        <span aria-current="page" className="font-medium text-[#333333]">
          {breadcrumb}
        </span>
      </nav>
      <div className="flex items-center gap-4">{children}</div>
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
  const color = variant === "accent" ? "text-[#FC4C02]" : "text-[#333333]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium ${color} ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
