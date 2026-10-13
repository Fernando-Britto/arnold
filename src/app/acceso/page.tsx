"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { KioscoAcceso } from "@/components/acceso/kiosco-acceso";
import { PanelDefinirPin } from "@/components/acceso/panel-definir-pin";
import { SectionPageLayout } from "@/components/layout/section-page-layout";

/** Roles que operan el kiosco de recepción (D-47 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/**
 * Página "/acceso" (T-035): kiosco de recepción para el check-in por DNI + PIN.
 * Flujo de staff (Administrador / Recepcionista); la pantalla de puerta llega en T-036.
 * El kiosco y el panel "Definir PIN" se muestran uno por vez: el panel se abre a propósito
 * para que nunca quede a la vista del socio.
 */
export function AccesoPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [mostrarDefinirPin, setMostrarDefinirPin] = useState(false);

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
          <p className="text-gray-600">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <SectionPageLayout
      breadcrumb="Control de acceso"
      actions={
        <button
          type="button"
          aria-expanded={mostrarDefinirPin}
          onClick={() => setMostrarDefinirPin((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-sm font-medium text-[#333333] hover:bg-zinc-50"
        >
          {mostrarDefinirPin ? "Volver al kiosco" : "Definir PIN"}
        </button>
      }
    >
      <h1 className="sr-only">Control de acceso</h1>

      {mostrarDefinirPin ? (
        <div className="flex grow items-center justify-center">
          <PanelDefinirPin />
        </div>
      ) : (
        <KioscoAcceso />
      )}
    </SectionPageLayout>
  );
}

export default AccesoPage;
