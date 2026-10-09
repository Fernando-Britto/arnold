"use client";

import React from "react";
import { Bell, LogOut, Search } from "lucide-react";

/**
 * TopNav — top navigation bar for the Socio-facing app (Home_Socio y afines).
 * Matches Home_Socio_1x design.
 *
 * Nota: la nav de las pantallas de gestión (Ejercicios/Rutinas/Membresías/
 * Clientes) es un componente distinto, `AdminTopNav` (./admin-top-nav.tsx),
 * porque son dos diseños de nav distintos (Home_Socio_1x vs los mockups de
 * gestión). `CrudPageLayout` usa `AdminTopNav`, no este.
 *
 * SCOPE GAP (documented): only /home-socio exists today. "Mi rutina",
 * "Mi membresía" and "Mi progreso" have no routes yet, so those links call
 * onNavigate (no-op by default) instead of a real next/link — wiring real
 * routes is follow-up work once those pages exist.
 */
export type TopNavLink = "inicio" | "rutina" | "membresia" | "progreso";

export interface TopNavProps {
  active?: TopNavLink;
  onNavigate?: (link: TopNavLink) => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onAvatarClick?: () => void;
  /** Cierra la sesión (P-06: sin esto el Socio no tenía forma de salir ni de revocar su token). */
  onLogoutClick?: () => void;
}

const LINKS: { key: TopNavLink; label: string }[] = [
  { key: "inicio", label: "Inicio" },
  { key: "rutina", label: "Mi rutina" },
  { key: "membresia", label: "Mi membresía" },
  { key: "progreso", label: "Mi progreso" },
];

export function TopNav({
  active = "inicio",
  onNavigate,
  onSearchClick,
  onNotificationsClick,
  onAvatarClick,
  onLogoutClick,
}: TopNavProps) {
  return (
    <div className="flex h-20 items-center justify-between bg-white px-12 shadow-[0px_1px_2px_rgba(0,0,0,0.051)]">
      <div className="flex items-center">
        <p className="text-xl font-bold text-zinc-900">ARNOLD</p>
        <p className="text-xl font-bold text-[#FC4C02]">GYM</p>
      </div>

      <div className="flex items-center gap-8">
        {LINKS.map((link) => {
          const isActive = link.key === active;
          return (
            <button
              key={link.key}
              type="button"
              data-testid={`nav-link-${link.key}`}
              data-active={isActive ? "true" : "false"}
              onClick={() => onNavigate?.(link.key)}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`text-[15px] ${
                  isActive ? "font-bold text-[#FC4C02]" : "font-medium text-zinc-500"
                }`}
              >
                {link.label}
              </span>
              {isActive && <span className="h-0.5 w-6 rounded-px bg-[#FC4C02]" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Buscar"
          onClick={onSearchClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100"
        >
          <Search className="h-5 w-5 text-zinc-500" />
        </button>
        <button
          type="button"
          aria-label="Notificaciones"
          onClick={onNotificationsClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100"
        >
          <Bell className="h-5 w-5 text-zinc-500" />
        </button>
        <button
          type="button"
          aria-label="Cerrar sesión"
          onClick={onLogoutClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200"
        >
          <LogOut className="h-5 w-5 text-zinc-500" />
        </button>
        <button
          type="button"
          aria-label="Perfil"
          onClick={onAvatarClick}
          className="h-10 w-10 rounded-lg bg-zinc-200"
        />
      </div>
    </div>
  );
}
