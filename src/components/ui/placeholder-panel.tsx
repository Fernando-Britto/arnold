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
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-[#E4E4E7] bg-white px-6 py-10 text-center ${className}`}
    >
      <Construction size={24} className="text-[#A1A5B0]" aria-hidden="true" />
      <p className="text-sm font-medium text-[#3D4454]">Trabajando en esto</p>
      {title && <p className="text-sm font-bold text-[#18181B]">{title}</p>}
      {description && <p className="text-sm text-[#71717A]">{description}</p>}
    </div>
  );
}
