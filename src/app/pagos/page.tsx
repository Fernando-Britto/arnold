"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { PagoForm } from "@/components/pago/pago-form";
import { SectionPageLayout } from "@/components/layout/section-page-layout";

/** Roles que pueden registrar pagos (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/**
 * Pantalla "Registrar Pago" (T-033): flujo de staff (Administrador / Recepcionista).
 * La pantalla "Mis pagos" del socio queda fuera de alcance (T-039).
 */
export function PagosPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !ALLOWED_ROLES.includes(user.rol)) {
      router.push("/home-socio");
    }
  }, [isAuthenticated, user, router]);

  const isAuthorized = isAuthenticated && user && ALLOWED_ROLES.includes(user.rol);

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
    <SectionPageLayout activeSection="pagos" breadcrumb="Registrar Pago">
      <h1 className="sr-only">Registrar Pago</h1>
      <PagoForm />
    </SectionPageLayout>
  );
}

export default PagosPage;
