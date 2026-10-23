"use client";

import React from "react";

/**
 * Rail vertical compartido por el socio y el staff.
 *
 * Misma pieza, dos juegos de destinos: el socio navega su entrenamiento, el staff su operación.
 * La barra horizontal anterior apretaba seis destinos en 80px de alto, sin lugar para agrupar ni
 * para la identidad. En vertical los destinos se leen como zonas con etiqueta y el pie queda libre
 * para quién es y cómo sale.
 */
export interface RailItem {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  /** Enlace real: los tests y la navegación del navegador necesitan un <a>. */
  href: string;
}

export interface RailZone {
  label?: string;
  items: RailItem[];
}

export interface AppRailProps {
  navLabel: string;
  zones: RailZone[];
  /** Identidad y salida (avatar, nombre, rol, cerrar sesión). */
  footer: React.ReactNode;
}

export function AppRail({ navLabel, zones, footer }: AppRailProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-surface-rail px-3.5 pb-5 pt-6 lg:sticky lg:top-0 lg:h-screen lg:w-[236px] lg:border-r lg:border-border-soft">
      <p className="px-2.5 text-lg font-black tracking-tight text-ink">
        ARNOLD<span className="text-brand">GYM</span>
      </p>

      <nav aria-label={navLabel} className="mt-7 flex flex-col">
        {zones.map((zone) => (
          <React.Fragment key={zone.label ?? "inicio"}>
            {zone.label && (
              <p className="mb-1.5 mt-5 px-2.5 text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">
                {zone.label}
              </p>
            )}
            {zone.items.map((item) => (
              <a
                key={item.key}
                href={item.href}
                data-testid={`nav-link-${item.key}`}
                data-active={item.active ? "true" : "false"}
                aria-current={item.active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  item.onSelect();
                }}
                className={`-ml-0.5 flex h-10 items-center gap-2.5 rounded-r-md border-l-2 px-2.5 text-sm ${
                  item.active
                    ? "border-brand bg-surface font-bold text-ink"
                    : "border-transparent font-medium text-ink-muted hover:text-ink"
                }`}
              >
                {item.active && (
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
                )}
                {item.label}
              </a>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-border-soft px-2.5 pt-4">
        {footer}
      </div>
    </aside>
  );
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-active text-sm font-bold text-ink-soft"
      >
        {nombre.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{nombre}</p>
        <p className="text-overline font-medium text-ink-disabled">{rol}</p>
      </div>
      <button
        type="button"
        aria-label="Cerrar sesión"
        onClick={onLogout}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-active hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      </button>
    </>
  );
}
