"use client";

import React from "react";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth";

export type NavSection = "membresias" | "rutinas" | "ejercicios" | "clientes";

interface NavItem {
  section: NavSection;
  label: string;
  href: string;
  roles: string[];
}

// Los roles coinciden con los permitidos en cada page.tsx
const NAV_ITEMS: NavItem[] = [
  { section: "membresias", label: "Membresías", href: "/membresias", roles: ["ADMINISTRADOR"] },
  { section: "rutinas", label: "Rutinas", href: "/rutinas", roles: ["ADMINISTRADOR", "INSTRUCTOR"] },
  { section: "ejercicios", label: "Ejercicios", href: "/ejercicios", roles: ["ADMINISTRADOR", "INSTRUCTOR"] },
  { section: "clientes", label: "Clientes", href: "/clientes", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
];

interface TopNavProps {
  /** Omitted on pages that aren't one of the CRUD sections (e.g. Home_Interno). */
  activeSection?: NavSection;
}

export function AdminTopNav({ activeSection }: TopNavProps) {
  const { user, logout } = useAuth();
  const items = user ? NAV_ITEMS.filter((item) => item.roles.includes(user.rol)) : [];

  return (
    <header className="flex h-20 items-center justify-between bg-white px-12 shadow-[0px_1px_3px_rgba(0,0,0,0.1)]">
      <div className="flex items-center">
        <span className="text-xl font-bold text-zinc-900">ARNOLD</span>
        <span className="text-xl font-bold text-[#FC4C02]">GYM</span>
      </div>

      <nav aria-label="Navegación principal" className="flex items-center gap-8">
        {items.map((item) => {
          const isActive = item.section === activeSection;
          return (
            <Link
              key={item.section}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 text-[15px] ${
                isActive ? "font-bold text-zinc-900" : "font-medium text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.label}
              {isActive && <span className="h-[2px] w-6 rounded-sm bg-[#FC4C02]" />}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {/* HI-1: las notificaciones no existen todavía. Se muestra deshabilitado
            (no un control clickeable inerte) con un título que lo explica. */}
        <button
          type="button"
          disabled
          aria-label="Notificaciones"
          title="Las notificaciones no están disponibles todavía"
          className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-zinc-100 opacity-40"
        >
          <Bell size={18} className="text-gray-500" />
        </button>
        <button type="button" aria-label="Cerrar sesión" onClick={() => void logout()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200">
          <LogOut size={18} className="text-gray-500" />
        </button>
        {user?.nombre && (
          <div
            aria-label={`Usuario: ${user.nombre}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700"
          >
            {user.nombre.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
