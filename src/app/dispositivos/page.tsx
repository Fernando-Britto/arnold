"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { SectionPageLayout } from "@/components/layout/section-page-layout";
import { DispositivosPanel } from "@/components/dispositivos/dispositivos-panel";

/** Solo el Administrador gestiona dispositivos (D-43 propuesta 4 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

/**
 * Pantalla "Dispositivos" (AC-11). La gestión vive en `DispositivosPanel`, compartido con la
 * pestaña "Dispositivos" de `/configuracion`; acá se mantiene la ruta directa con su guardia.
 */
export function DispositivosPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const isAuthorized = Boolean(isAuthenticated && user && ALLOWED_ROLES.includes(user.rol));

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !ALLOWED_ROLES.includes(user.rol)) {
      router.push("/home-socio");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Acceso Denegado</h1>
          <p className="text-ink-muted">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <SectionPageLayout breadcrumb="Dispositivos" activeSection="dispositivos">
      <h1 className="sr-only">Dispositivos</h1>
      <DispositivosPanel />
    </SectionPageLayout>
  );
}

export default DispositivosPage;
