import React from "react";
import { Construction } from "lucide-react";

interface PlaceholderPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Reusable panel for features the system does not implement yet.
 * Shows the copy "Trabajando en esto" instead of inventing content.
 */
export function PlaceholderPanel({ title, description, className = "" }: PlaceholderPanelProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center ${className}`}
    >
      <Construction size={24} className="text-ink-disabled" aria-hidden="true" />
      <p className="text-sm font-medium text-ink-soft">Trabajando en esto</p>
      {title && <p className="text-sm font-bold text-ink">{title}</p>}
      {description && <p className="text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
