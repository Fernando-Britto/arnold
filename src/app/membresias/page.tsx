"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { Membresia } from "@/domains/membresia/membresia";
import { MembresiaFormPanel } from "@/components/membresia-crud/membresia-form-panel";
import { MembresiaListPanel } from "@/components/membresia-crud/membresia-list-panel";

export function MembresiasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [selectedMembresia, setSelectedMembresia] = React.useState<Membresia | null>(null);

  // Check authentication and authorization
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Only ADMINISTRADOR can access this page
    const allowedRoles = ["ADMINISTRADOR"];
    if (user && !allowedRoles.includes(user.rol)) {
      router.push("/home-socio");
      return;
    }
  }, [isAuthenticated, user, router]);

  // Check if user is authorized before rendering
  const isAuthorized =
    isAuthenticated &&
    user &&
    ["ADMINISTRADOR"].includes(user.rol);

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">
            No tienes permiso para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Page title */}
      <h1 className="text-3xl font-bold">Membresías</h1>

      {/* Main content - two column layout */}
      <div className="flex gap-6">
        {/* Form panel - left */}
        <div className="w-96 border border-gray-200 rounded-lg bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h2 className="font-bold text-lg">
              {selectedMembresia ? "Editar Membresía" : "Nueva Membresía"}
            </h2>
          </div>
          <MembresiaFormPanel
            initialData={selectedMembresia}
            onCancel={() => setSelectedMembresia(null)}
            isEdit={!!selectedMembresia?.id}
          />
        </div>

        {/* List panel - right */}
        <div className="flex-1 border border-gray-200 rounded-lg bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h2 className="font-bold text-lg">Membresías Disponibles</h2>
          </div>
          <MembresiaListPanel
            onEditClick={(membresia) => setSelectedMembresia(membresia as Membresia)}
          />
        </div>
      </div>
    </div>
  );
}

export default MembresiasPage;
