"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Cog,
  CreditCard,
  Dumbbell,
  IdCard,
  LayoutDashboard,
  Lock,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
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
  icon: LucideIcon;
}

/**
 * Zonas del mockup de la barra lateral: el agrupado sigue el modelo de datos (Socios,
 * Entrenamiento, Caja) y no el trabajo diario de cada rol. "Hoy" va suelto arriba y
 * Configuración anclada al pie, separada del resto.
 *
 * "Control de Acceso" y "Dispositivos" siguen fuera del rail a propósito: el kiosco se abre y
 * se deja corriendo, y los dispositivos se administran desde Configuración.
 */
const ZONES: { label?: string; pinFondo?: boolean; items: NavItem[] }[] = [
  {
    label: "Socios",
    items: [
      {
        section: "clientes",
        label: "Clientes",
        href: "/clientes",
        roles: ["ADMINISTRADOR", "RECEPCIONISTA"],
        icon: Users,
      },
      {
        section: "membresias",
        label: "Membresías",
        href: "/membresias",
        roles: ["ADMINISTRADOR"],
        icon: IdCard,
      },
    ],
  },
  {
    label: "Entrenamiento",
    items: [
      {
        section: "rutinas",
        label: "Rutinas",
        href: "/rutinas",
        roles: ["ADMINISTRADOR", "INSTRUCTOR"],
        icon: ClipboardList,
      },
      {
        section: "ejercicios",
        label: "Ejercicios",
        href: "/ejercicios",
        roles: ["ADMINISTRADOR", "INSTRUCTOR"],
        icon: Dumbbell,
      },
      {
        section: "maquinas",
        label: "Máquinas",
        href: "/maquinas",
        roles: ["ADMINISTRADOR"],
        icon: Cog,
      },
    ],
  },
  {
    label: "Caja",
    items: [
      {
        section: "pagos",
        label: "Pagos",
        href: "/pagos",
        roles: ["ADMINISTRADOR", "RECEPCIONISTA"],
        icon: CreditCard,
      },
      {
        section: "cierres",
        label: "Cierres de caja",
        href: "/cierres",
        roles: ["ADMINISTRADOR", "RECEPCIONISTA"],
        icon: Lock,
      },
    ],
  },
  {
    pinFondo: true,
    items: [
      {
        section: "configuracion",
        label: "Configuración",
        href: "/configuracion",
        roles: ["ADMINISTRADOR"],
        icon: SlidersHorizontal,
      },
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
  // etiqueta "Caja" sin destinos debajo.
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
          icon: LayoutDashboard,
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
        icon: item.icon,
      }));
    if (items.length > 0) zones.push({ label: zone.label, pinFondo: zone.pinFondo, items });
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
