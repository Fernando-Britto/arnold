"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { SocioRail } from "@/components/layout/socio-rail";
import { topNavHref, type TopNavLink } from "@/components/layout/top-nav";

/**
 * Marco de las secciones del socio.
 *
 * Cambió de barra horizontal a rail vertical y adoptó el sustrato oscuro (`theme-dark`):
 * el socio usa esto de noche, en el celular, entre series. El rail agrupa las seis secciones
 * en tres zonas y deja el pie para la identidad y la salida.
 *
 * El `main` mantiene el padding y el gap del diseño, y en mobile se apila debajo del rail.
 */
export function SocioShell({ active, children }: { active: TopNavLink; children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="theme-dark flex min-h-screen flex-col bg-surface-page lg:flex-row">
      <SocioRail
        active={active}
        onNavigate={(link) => router.push(topNavHref(link))}
        onLogoutClick={() => void logout()}
      />
      <main className="mx-auto flex w-full min-w-0 max-w-[1360px] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-6">{children}</main>
    </div>
  );
}
