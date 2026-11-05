"use client";

import React from "react";
import type { TopNavLink } from "@/components/layout/top-nav";
import { SocioShell } from "@/components/home-socio/socio-shell";
import { useSeccionesSocio } from "@/components/home-socio/use-secciones-socio";
import type { HomeSocioSeccionesViewModel } from "@/api/home-socio-secciones";

/**
 * Página de sección del socio: resuelve la sesión, carga el payload de
 * `/api/home-socio/secciones` y delega el render a `children` con los datos (o `null` mientras
 * espera) y el estado de carga. El shell, el rail y los títulos se dibujan al instante; solo el
 * contenido que depende de la base espera un pulso. El error conserva su alerta.
 */
export function SocioSeccionPage({
  active,
  children,
}: {
  active: TopNavLink;
  children: (data: HomeSocioSeccionesViewModel | null, cargando: boolean) => React.ReactNode;
}) {
  const { data, loading, error, isAuthenticated, isMember } = useSeccionesSocio();

  if (!isAuthenticated || !isMember) return null;

  if (error) {
    return (
      <SocioShell active={active}>
        <p role="alert" className="text-danger">
          {error}
        </p>
      </SocioShell>
    );
  }

  return <SocioShell active={active}>{children(data, loading)}</SocioShell>;
}
