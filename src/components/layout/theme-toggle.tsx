"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { alternarTema } from "@/lib/tema";

/**
 * Selector de tema del rail. El icono muestra la acción, no el estado: sol cuando estás en
 * oscuro (pasás a claro) y luna cuando estás en claro. La visibilidad la resuelve el CSS con
 * `[data-tema]`, así no hay estado React ni parpadeo durante la hidratación.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label="Cambiar tema"
      title="Cambiar entre tema claro y oscuro"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-active hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
    >
      <Moon className="tema-icono-luna h-4 w-4" aria-hidden="true" />
      <Sun className="tema-icono-sol h-4 w-4" aria-hidden="true" />
    </button>
  );
}
