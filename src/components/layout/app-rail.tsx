"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut, PanelLeft } from "lucide-react";
import { alternarRail } from "@/lib/rail";
import { ThemeToggle } from "./theme-toggle";

/**
 * Rail vertical compartido por el socio y el staff.
 *
 * Misma pieza, dos juegos de destinos: el socio navega su entrenamiento, el staff su operación.
 * El diseño viene del mockup `Sidebar propuesta-html.zip`: filas de 44px con ícono, barra
 * naranja interna en el destino activo y zonas con etiqueta. El mockup es oscuro fijo; acá el
 * rail usa los tokens del tema, así acompaña al resto de la app en claro y en oscuro.
 */
export interface RailItem {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  /** Enlace real: los tests y la navegación del navegador necesitan un <a>. */
  href: string;
  icon: LucideIcon;
}

export interface RailZone {
  label?: string;
  items: RailItem[];
  /** Ancla la zona al pie del nav (Configuración), separada del resto. */
  pinFondo?: boolean;
}

export interface AppRailProps {
  navLabel: string;
  zones: RailZone[];
  /** Identidad y salida (avatar, nombre, rol, cerrar sesión). */
  footer: React.ReactNode;
}

export function AppRail({ navLabel, zones, footer }: AppRailProps) {
  return (
    <aside className="rail flex w-full shrink-0 flex-col bg-surface-rail px-3 pb-4 pt-4 lg:sticky lg:top-0 lg:h-screen lg:w-[280px] lg:border-r lg:border-border-soft">
      <div className="rail-cabecera flex items-center justify-between gap-2 pb-5 pl-1">
        <p className="rail-marca text-xl font-extrabold tracking-tight text-ink">
          ARNOLD<span className="text-brand">GYM</span>
        </p>
        <div className="rail-acciones flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={alternarRail}
            aria-label="Contraer barra lateral"
            title="Contraer o expandir la barra lateral"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav aria-label={navLabel} className="flex flex-1 flex-col gap-4">
        {zones.map((zone, indice) => (
          <div
            key={zone.label ?? `zona-${indice}`}
            className={`flex flex-col gap-0.5 ${zone.pinFondo ? "mt-auto" : ""}`}
          >
            {zone.label && (
              <p className="rail-zona flex h-8 items-center px-3 text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">
                {zone.label}
              </p>
            )}
            {zone.items.map((item) => (
              <RailLink key={item.key} item={item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-pie mt-3 flex items-center gap-3 border-t border-border-soft pl-1 pt-4">
        {footer}
      </div>
    </aside>
  );
}

function RailLink({ item }: { item: RailItem }) {
  const Icono = item.icon;
  return (
    <a
      href={item.href}
      title={item.label}
      data-testid={`nav-link-${item.key}`}
      data-active={item.active ? "true" : "false"}
      aria-current={item.active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        item.onSelect();
      }}
      className={`rail-fila flex h-11 items-center gap-3 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand ${
        item.active
          ? "bg-surface-subtle font-semibold text-ink shadow-[inset_3px_0_0_0_var(--color-brand)]"
          : "font-medium text-ink-soft hover:bg-surface-subtle hover:text-ink"
      }`}
    >
      <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="rail-label flex-1 truncate">{item.label}</span>
    </a>
  );
}

/** Dos iniciales del nombre ("Admin Arnold" → "AA"); una sola palabra deja una. */
function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join("");
}

/** Avatar + nombre + rol + botón de salida, para el pie del rail. */
export function RailFooter({
  nombre,
  rol,
  onLogout,
}: {
  nombre: string;
  rol: string;
  onLogout?: () => void;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-active text-meta font-bold text-ink-soft"
      >
        {iniciales(nombre)}
      </span>
      <div className="rail-identidad min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{nombre}</p>
        <p className="text-meta font-medium text-ink-disabled">{rol}</p>
      </div>
      <button
        type="button"
        aria-label="Cerrar sesión"
        onClick={onLogout}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </>
  );
}
