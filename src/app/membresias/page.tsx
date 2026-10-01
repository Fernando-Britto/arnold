"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { Membresia } from "@/domains/membresia/membresia";
import { MembresiaFormPanel } from "@/components/membresia-crud/membresia-form-panel";
import { MembresiaListPanel } from "@/components/membresia-crud/membresia-list-panel";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "@/components/layout/crud-page-layout";

export function MembresiasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [selectedMembresia, setSelectedMembresia] = useState<Membresia | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const handleFormSuccess = (membresia: Membresia) => {
    // Clear form selection and trigger list refresh
    setSelectedMembresia(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setSelectedMembresia(null);
  };

  const handleEditMembresia = (membresia: Membresia & { assignedSocioCount: number }) => {
    setSelectedMembresia(membresia as Membresia);
  };

  return (
    <>
      <h1 className="sr-only">Membresías</h1>

      <CrudPageLayout
        section="membresias"
        breadcrumb="Membresías"
        formPanel={
          <FormPanelShell
            title={selectedMembresia ? "Editar Membresía" : "Nueva Membresía"}
            titleTestId="form-title"
          >
            <MembresiaFormPanel
              initialData={selectedMembresia}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              isEdit={!!selectedMembresia?.id}
            />
          </FormPanelShell>
        }
        listPanel={
          <ListPanelShell>
            <MembresiaListPanel
              key={`membresia-list-${refreshTrigger}`}
              onEditClick={handleEditMembresia}
            />
          </ListPanelShell>
        }
      />
    </>
  );
}

export default MembresiasPage;
