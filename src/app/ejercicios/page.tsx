"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ejercicio } from "@prisma/client";
import { EjercicioForm } from "@/components/ejercicio-crud/ejercicio-form";
import { EjercicioListPanel } from "@/components/ejercicio-crud/ejercicio-list";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError, handleApiError } from "@/utils/api-error";
import { fetchEjercicios, createEjercicio, updateEjercicio, deleteEjercicio } from "@/api/ejercicios";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "@/components/layout/crud-page-layout";
import { CrudActions } from "@/components/layout/crud-actions";

export function EjerciciosPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Ejercicio | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Only ADMINISTRADOR and INSTRUCTOR can access this page
    const allowedRoles = ["ADMINISTRADOR", "INSTRUCTOR"];
    if (user && !allowedRoles.includes(user.rol)) {
      router.push("/home-socio");
      return;
    }
  }, [isAuthenticated, user, router]);

  // Fetch ejercicios on mount
  useEffect(() => {
    const loadEjercicios = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchEjercicios();
        setEjercicios(data);
      } catch (err) {
        setError(handleApiError(err, "No se pudieron cargar los ejercicios."));
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadEjercicios();
    }
  }, [isAuthenticated, user]);

  const handleSave = async (formData: {
    id?: string;
    nombre: string;
    grupoMuscular: string;
    descripcion: string;
  }) => {
    try {
      setIsSaving(true);
      setError(null);

      let savedEjercicio: Ejercicio;

      if (formData.id) {
        // Update existing
        savedEjercicio = await updateEjercicio(formData.id, {
          nombre: formData.nombre,
          grupoMuscular: formData.grupoMuscular,
          descripcion: formData.descripcion || undefined,
        });

        // Update in list
        setEjercicios(prev =>
          prev.map(e => (e.id === formData.id ? savedEjercicio : e))
        );
        notify("success", "Ejercicio actualizado");
      } else {
        // Create new
        savedEjercicio = await createEjercicio({
          nombre: formData.nombre,
          grupoMuscular: formData.grupoMuscular,
          descripcion: formData.descripcion || undefined,
        });

        // Add to list
        setEjercicios(prev => [...prev, savedEjercicio]);
        notify("success", "Ejercicio creado");
      }

      // Reset form and selection
      setEditing(null);
      setSelectedId(null);
      // AC-004: el form usa el Ejercicio devuelto para mostrar el ID tras crear.
      return savedEjercicio;
    } catch (err) {
      setError(handleApiError(err, "No se pudo guardar el ejercicio."));
    } finally {
      setIsSaving(false);
    }
  };

  // Segundo clic sobre la misma fila la cierra: el detalle vive sólo mientras está abierta.
  const handleSelect = (ejercicio: Ejercicio) => {
    setSelectedId((prev) => (prev === ejercicio.id ? null : ejercicio.id));
  };

  const handleModify = () => {
    const ejercicio = ejercicios.find((e) => e.id === selectedId) ?? null;
    if (ejercicio) setEditing(ejercicio);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const ejercicio = ejercicios.find((e) => e.id === selectedId);
    if (!ejercicio) return;
    if (typeof window !== "undefined" && !window.confirm(`¿Está seguro que desea eliminar "${ejercicio.nombre}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteEjercicio(selectedId);
      setEjercicios(prev => prev.filter(e => e.id !== selectedId));
      if (editing?.id === selectedId) {
        setEditing(null);
      }
      setSelectedId(null);
      notify("success", "Ejercicio eliminado");
    } catch (err) {
      // Integridad referencial: el servidor responde 409 DELETE_BLOCKED_ASSIGNED con el
      // mensaje de la relación que bloquea (rutinas o historial de entrenamiento, H11).
      if (err instanceof ApiError && err.code === "DELETE_BLOCKED_ASSIGNED") {
        setError(err.message || "No se puede eliminar: este ejercicio está en uso");
      } else {
        setError(handleApiError(err, "No se pudo eliminar el ejercicio."));
      }
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
      {/* Título accesible: el diseño no repite un h1 grande, la sección ya se ve en el TopNav/breadcrumb */}
      <h1 className="sr-only">Ejercicios</h1>

      <CrudPageLayout
        section="ejercicios"
        breadcrumb="Ejercicios"
        error={error}
        actions={
          <CrudActions
            hasSelection={!!selectedId}
            onModify={handleModify}
            onDelete={handleDelete}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchLabel="Buscar ejercicios"
            searchPlaceholder="Buscar por nombre o grupo muscular..."
          />
        }
        formPanel={
          <FormPanelShell
            title={editing ? "Editar Ejercicio" : "Nuevo Ejercicio"}
            headerAction={
              editing && (
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
                >
                  Cancelar
                </button>
              )
            }
          >
            <EjercicioForm
              onSave={handleSave}
              initialData={editing}
              isLoading={isSaving}
            />
          </FormPanelShell>
        }
        listPanel={
          <ListPanelShell>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500">Cargando ejercicios...</p>
              </div>
            ) : (
              <EjercicioListPanel
                ejercicios={ejercicios}
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

export default EjerciciosPage;
