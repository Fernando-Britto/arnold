"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ejercicio } from "@prisma/client";
import { RutinaForm } from "@/components/rutina-crud/rutina-form";
import { type EjercicioEnRutinaRow } from "@/components/rutina-crud/ejercicio-en-rutina-list";
import { RutinaListPanel } from "@/components/rutina-crud/rutina-list";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";
import {
  fetchRutinas,
  fetchRutina,
  createRutina,
  updateRutina,
  deleteRutina,
  type RutinaWithCount,
  type RutinaDetalle,
} from "@/api/rutinas";
import { fetchEjercicios } from "@/api/ejercicios";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "@/components/layout/crud-page-layout";
import { CrudActions } from "@/components/layout/crud-actions";

export function RutinasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [rutinas, setRutinas] = useState<RutinaWithCount[]>([]);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RutinaDetalle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
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
        setError(handleApiError(err, "No se pudieron cargar las rutinas."));
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
    ejercicios?: EjercicioEnRutinaRow[];
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
        notify("success", "Rutina actualizada");

        // Al terminar una edición, volver al estado de alta.
        setEditing(null);
        setSelectedId(null);
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
        notify("success", "Rutina creada");

        // H-8 / AC: surface the new rutina's id. Keeping it selected loads it back
        // into the form, where the ID field is read-only and now populated.
        setSelectedId(created.id);
        setEditing({ ...created, ejercicios: formData.ejercicios ?? [] });
      }
    } catch (err) {
      setError(handleApiError(err, "No se pudo guardar la rutina."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (rutina: RutinaWithCount) => {
    setSelectedId(rutina.id);
  };

  const handleModify = async () => {
    if (!selectedId) return;
    try {
      setError(null);
      setIsLoadingDetail(true);
      // Load the full detail (with exercises) before opening the form: the list
      // item only carries `_count`, so editing from it would wipe the subsection.
      const detail = await fetchRutina(selectedId);
      setEditing(detail);
    } catch (err) {
      setError(handleApiError(err, "No se pudo cargar la rutina."));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const rutina = rutinas.find((r) => r.id === selectedId);
    if (!rutina) return;
    if (typeof window !== "undefined" && !window.confirm(`¿Está seguro que desea eliminar "${rutina.nombre}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteRutina(selectedId);
      setRutinas((prev) => prev.filter((r) => r.id !== selectedId));
      if (editing?.id === selectedId) {
        setEditing(null);
      }
      setSelectedId(null);
      notify("success", "Rutina eliminada");
    } catch (err) {
      setError(handleApiError(err, "No se pudo eliminar la rutina."));
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
        actions={
          <CrudActions
            hasSelection={!!selectedId}
            onModify={handleModify}
            onDelete={handleDelete}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchLabel="Buscar rutinas"
            searchPlaceholder="Buscar por nombre u objetivo..."
          />
        }
        formPanel={
          <FormPanelShell
            title={editing ? "Editar Rutina" : "Nueva Rutina"}
            headerAction={
              editing && (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs font-medium text-[#C13D00] hover:underline"
                >
                  + Nueva Rutina
                </button>
              )
            }
          >
            <RutinaForm
              onSave={handleSave}
              initialData={editing}
              availableEjercicios={ejercicios}
              isLoading={isSaving || isLoadingDetail}
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
                selectedId={selectedId}
                onSelect={handleSelect}
                searchTerm={searchTerm}
              />
            )}
          </ListPanelShell>
        }
      />
    </>
  );
}

export default RutinasPage;
