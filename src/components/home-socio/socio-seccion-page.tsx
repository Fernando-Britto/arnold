"use client";

import React from "react";
import type { TopNavLink } from "@/components/layout/top-nav";
import { SocioShell } from "@/components/home-socio/socio-shell";
import { useSeccionesSocio } from "@/components/home-socio/use-secciones-socio";
import type { HomeSocioSeccionesViewModel } from "@/api/home-socio-secciones";

/**
 * Página de sección del socio: resuelve la sesión, carga el payload de
 * `/api/home-socio/secciones` y delega el render a `children` con los datos listos.
 * Maneja carga y error de forma uniforme (mismo lenguaje visual que Home_Socio).
 */
export function SocioSeccionPage({
  active,
  children,
}: {
  active: TopNavLink;
  children: (data: HomeSocioSeccionesViewModel) => React.ReactNode;
}) {
  const { data, loading, error, isAuthenticated, isMember } = useSeccionesSocio();

  if (!isAuthenticated || !isMember) return null;

  if (loading) {
    return (
      <SocioShell active={active}>
        <p className="text-gray-500">Cargando...</p>
      </SocioShell>
    );
  }

  if (error || !data) {
    return (
      <SocioShell active={active}>
        <p role="alert" className="text-red-600">
          {error ?? "No pudimos cargar tus datos. Probá de nuevo en un momento."}
        </p>
      </SocioShell>
    );
  }

  return <SocioShell active={active}>{children(data)}</SocioShell>;
}
