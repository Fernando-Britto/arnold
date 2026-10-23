"use client";

import React from "react";
import { useAuth } from "@/contexts/auth";
import { AppRail, RailFooter, type RailZone } from "./app-rail";
import { topNavHref, type TopNavLink } from "./top-nav";

/**
 * Rail del socio. Los seis destinos se leen como tres zonas con etiqueta: el socio ve dónde está
 * sin contar ítems, y el pie queda libre para quién es y cómo sale.
 *
 * Conserva los `data-testid="nav-link-*"` y `data-active` del nav anterior, que es el contrato de
 * navegación que usan las pantallas y sus tests.
 */
const ZONES: { label?: string; links: { key: TopNavLink; label: string }[] }[] = [
  { links: [{ key: "inicio", label: "Hoy" }] },
  {
    label: "Entrenamiento",
    links: [
      { key: "rutina", label: "Mi rutina" },
      { key: "ejercicios", label: "Mis ejercicios" },
      { key: "progreso", label: "Mi progreso" },
    ],
  },
  {
    label: "Mi cuenta",
    links: [
      { key: "membresia", label: "Mi membresía" },
      { key: "asistencias", label: "Mis asistencias" },
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
