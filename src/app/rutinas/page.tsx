"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ejercicio } from "@prisma/client";
import { RutinaForm } from "@/components/rutina-crud/rutina-form";
import { RutinaListPanel } from "@/components/rutina-crud/rutina-list";
import { useAuth } from "@/contexts/auth";
import {
  fetchRutinas,
  createRutina,
  updateRutina,
  deleteRutina,
  type RutinaWithCount,
} from "@/api/rutinas";
import { fetchEjercicios } from "@/api/ejercicios";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "@/components/layout/crud-page-layout";

export function RutinasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [rutinas, setRutinas] = useState<RutinaWithCount[]>([]);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [selectedRutina, setSelectedRutina] = useState<RutinaWithCount | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Only ADMINISTRADOR and INSTRUCTOR can access this page (RN-06)
    const allowedRoles = ["ADMINISTRADOR", "INSTRUCTOR"];
    if (user && !allowedRoles.includes(user.rol)) {
      router.push("/home-socio");
      return;
    }
  }, [isAuthenticated, user, router]);

  // Fetch rutinas and ejercicios on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rutinasData, ejerciciosData] = await Promise.all([
          fetchRutinas(),
          fetchEjercicios(),
        ]);
        setRutinas(rutinasData);
        setEjercicios(ejerciciosData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadData();
    }
  }, [isAuthenticated, user]);

  const handleSave = async (formData: {
    id?: string;
    nombre: string;
    objetivoPrincipal: string;
    frecuenciaSemanal: number;
    duracionEstimada: number;
    nivelDeDificultad: string;
    descripcion?: string;
    ejercicios?: any[];
  }) => {
    try {
      setIsSaving(true);
      setError(null);
      const exerciseCount = formData.ejercicios?.length ?? 0;

      if (formData.id) {
        // Update existing
        const updated = await updateRutina(formData.id, {
          nombre: formData.nombre,
          objetivoPrincipal: formData.objetivoPrincipal,
          frecuenciaSemanal: formData.frecuenciaSemanal,
          duracionEstimada: formData.duracionEstimada,
          nivelDeDificultad: formData.nivelDeDificultad,
          descripcion: formData.descripcion || undefined,
          ejercicios: formData.ejercicios,
        });

        const savedRutina: RutinaWithCount = {
          ...updated,
          _count: {
            ejercicios:
              formData.ejercicios !== undefined
                ? exerciseCount
                : rutinas.find((r) => r.id === formData.id)?._count?.ejercicios ?? 0,
          },
        };

        // Update in list
        setRutinas((prev) =>
          prev.map((r) => (r.id === formData.id ? savedRutina : r))
        );
      } else {
        // Create new
        const created = await createRutina({
          nombre: formData.nombre,
          objetivoPrincipal: formData.objetivoPrincipal,
          frecuenciaSemanal: formData.frecuenciaSemanal,
          duracionEstimada: formData.duracionEstimada,
          nivelDeDificultad: formData.nivelDeDificultad,
          descripcion: formData.descripcion || undefined,
          ejercicios: formData.ejercicios,
        });

        const savedRutina: RutinaWithCount = {
          ...created,
          _count: { ejercicios: exerciseCount },
        };

        // Add to list with accurate exercises count
        setRutinas((prev) => [...prev, savedRutina]);
      }

      // Reset form
      setSelectedRutina(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsSaving(false);
    }
  };

  const handleModify = (rutina: RutinaWithCount) => {
    setSelectedRutina(rutina);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteRutina(id);
      setRutinas((prev) => prev.filter((r) => r.id !== id));
      if (selectedRutina?.id === id) {
        setSelectedRutina(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error deleting rutina";
      setError(errorMessage);
    }
  };

  // Check if user is authorized before rendering
  const isAuthorized =
    isAuthenticated &&
    user &&
    ["ADMINISTRADOR", "INSTRUCTOR"].includes(user.rol);

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
    <>
      <h1 className="sr-only">Rutinas</h1>

      <CrudPageLayout
        section="rutinas"
        breadcrumb="Rutinas"
        error={error}
        formPanel={
          <FormPanelShell
            title={selectedRutina ? "Editar Rutina" : "Nueva Rutina"}
            headerAction={
              selectedRutina && (
                <button
                  type="button"
                  onClick={() => setSelectedRutina(null)}
                  className="text-xs font-medium text-[#C13D00] hover:underline"
                >
                  + Nueva Rutina
                </button>
              )
            }
          >
            <RutinaForm
              onSave={handleSave}
              initialData={selectedRutina}
              availableEjercicios={ejercicios}
              isLoading={isSaving}
            />
          </FormPanelShell>
        }
        listPanel={
          <ListPanelShell>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500">Cargando rutinas...</p>
              </div>
            ) : (
              <RutinaListPanel
                rutinas={rutinas}
                onModify={handleModify}
                onDelete={handleDelete}
              />
            )}
          </ListPanelShell>
        }
      />
    </>
  );
}

export default RutinasPage;
