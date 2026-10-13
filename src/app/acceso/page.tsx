"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { KioscoAcceso } from "@/components/acceso/kiosco-acceso";

/** Roles que operan el kiosco de recepción (D-47 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/**
 * Página "/acceso" (T-035): kiosco de recepción para el check-in por DNI + PIN.
 * Flujo de staff (Administrador / Recepcionista); la pantalla de puerta llega en T-036.
 */
export function AccesoPage() {
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
          <p className="text-gray-600">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="sr-only">Control de acceso</h1>
      <KioscoAcceso />
    </div>
  );
}

export default AccesoPage;
