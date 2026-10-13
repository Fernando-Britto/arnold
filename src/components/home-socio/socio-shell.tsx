"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { TopNav, topNavHref, type TopNavLink } from "@/components/layout/top-nav";

/**
 * Marco de las secciones del socio (T-039): TopNav con navegación real + logout, y el
 * contenedor con el mismo lenguaje visual que Home_Socio. Presentacional.
 */
export function SocioShell({ active, children }: { active: TopNavLink; children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <TopNav
        active={active}
        onNavigate={(link) => router.push(topNavHref(link))}
        onLogoutClick={() => void logout()}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-12">{children}</main>
    </div>
  );
}
