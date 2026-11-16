"use client";

import React from "react";
import { CalendarCheck, ClipboardList, Dumbbell, Gauge, IdCard, LayoutDashboard, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { AppRail, RailFooter, type RailZone } from "./app-rail";
import { topNavHref, type TopNavLink } from "./top-nav";

/**
 * Rail del socio. Mismos destinos y mismas zonas que antes, con los íconos y las filas del
 * mockup de la barra lateral. Conserva los `data-testid="nav-link-*"` y `data-active`, que es
 * el contrato de navegación que usan las pantallas y sus tests.
 */
const ZONES: { label?: string; links: { key: TopNavLink; label: string; icon: LucideIcon }[] }[] = [
  { links: [{ key: "inicio", label: "Hoy", icon: LayoutDashboard }] },
  {
    label: "Entrenamiento",
    links: [
      { key: "rutina", label: "Mi rutina", icon: ClipboardList },
      { key: "ejercicios", label: "Mis ejercicios", icon: Dumbbell },
      { key: "progreso", label: "Mi progreso", icon: Gauge },
    ],
  },
  {
    label: "Mi cuenta",
    links: [
      { key: "membresia", label: "Mi membresía", icon: IdCard },
      { key: "asistencias", label: "Mis asistencias", icon: CalendarCheck },
    ],
  },
];

export interface SocioRailProps {
  active?: TopNavLink;
  onNavigate?: (link: TopNavLink) => void;
  onLogoutClick?: () => void;
}

export function SocioRail({ active = "inicio", onNavigate, onLogoutClick }: SocioRailProps) {
  const { user } = useAuth();

  const zones: RailZone[] = ZONES.map((zone) => ({
    label: zone.label,
    items: zone.links.map((link) => ({
      key: link.key,
      label: link.label,
      href: topNavHref(link.key),
      active: link.key === active,
      onSelect: () => onNavigate?.(link.key),
      icon: link.icon,
    })),
  }));

  return (
    <AppRail
      navLabel="Secciones del socio"
      zones={zones}
      footer={
        <RailFooter
          nombre={user?.nombre ?? "Socio"}
          rol="Socio"
          onLogout={onLogoutClick}
        />
      }
    />
  );
}
