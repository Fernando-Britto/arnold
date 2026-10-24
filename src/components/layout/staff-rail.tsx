"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { AppRail, RailFooter, type RailZone } from "./app-rail";

export type NavSection =
  | "inicio"
  | "membresias"
  | "rutinas"
  | "ejercicios"
  | "maquinas"
  | "clientes"
  | "pagos"
  | "cierres"
  | "acceso"
  | "dispositivos"
  | "configuracion";

interface NavItem {
  section: NavSection;
  label: string;
  href: string;
  roles: string[];
}

/**
 * Las zonas siguen el trabajo del staff, no el modelo de datos.
 *
 * Antes la navegación era una lista plana de cinco entidades y **Pagos y Cierres no estaban**:
 * solo se llegaba a ellas desde los atajos del panel. Un RECEPCIONISTA —cuyo trabajo diario es
 * cobrar y cerrar caja— veía únicamente "Clientes". Ahora "Comercial" agrupa membresías, pagos y
 * cierres, y "Operación" el día a día del salón.
 *
 * "Control de Acceso" queda fuera a propósito: es un kiosco que se abre y se deja corriendo, no
 * un destino al que se navega.
 */
const ZONES: { label?: string; items: NavItem[] }[] = [
  {
    label: "Operación",
    items: [
      { section: "clientes", label: "Clientes", href: "/clientes", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
      { section: "rutinas", label: "Rutinas", href: "/rutinas", roles: ["ADMINISTRADOR", "INSTRUCTOR"] },
      { section: "ejercicios", label: "Ejercicios", href: "/ejercicios", roles: ["ADMINISTRADOR", "INSTRUCTOR"] },
      { section: "maquinas", label: "Máquinas", href: "/maquinas", roles: ["ADMINISTRADOR"] },
    ],
  },
  {
    label: "Comercial",
    items: [
      { section: "membresias", label: "Membresías", href: "/membresias", roles: ["ADMINISTRADOR"] },
      { section: "pagos", label: "Pagos", href: "/pagos", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
      { section: "cierres", label: "Cierres", href: "/cierres", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { section: "configuracion", label: "Configuración", href: "/configuracion", roles: ["ADMINISTRADOR"] },
    ],
  },
];

const STAFF = ["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"];

const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  INSTRUCTOR: "Instructor",
  RECEPCIONISTA: "Recepción",
};

export interface StaffRailProps {
  /** Omitted on staff screens that are not one of the top-level sections. */
  activeSection?: NavSection;
}

export function StaffRail({ activeSection }: StaffRailProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const rol = user?.rol ?? "";
  const puedeInicio = STAFF.includes(rol);

  // Cada zona se filtra por rol y las vacías no se renderizan: un INSTRUCTOR no debe ver una
  // etiqueta "Comercial" sin destinos debajo.
  const zones: RailZone[] = [];
  if (puedeInicio) {
    zones.push({
      items: [
        {
          key: "inicio",
          label: "Hoy",
          href: "/home-interno",
          active: activeSection === "inicio",
          onSelect: () => router.push("/home-interno"),
        },
      ],
    });
  }
  for (const zone of ZONES) {
    const items = zone.items
      .filter((item) => user && item.roles.includes(rol))
      .map((item) => ({
        key: item.section,
        label: item.label,
        href: item.href,
        active: item.section === activeSection,
        onSelect: () => router.push(item.href),
      }));
    if (items.length > 0) zones.push({ label: zone.label, items });
  }

  return (
    <AppRail
      navLabel="Navegación principal"
      zones={zones}
      footer={
        <RailFooter
          nombre={user?.nombre ?? "Staff"}
          rol={ROL_LABEL[rol] ?? "Staff"}
          onLogout={() => void logout()}
        />
      }
    />
  );
}
