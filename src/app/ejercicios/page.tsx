"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ejercicio } from "@prisma/client";
import { EjercicioForm } from "@/components/ejercicio-crud/ejercicio-form";
import { EjercicioListPanel } from "@/components/ejercicio-crud/ejercicio-list";
import { useAuth } from "@/contexts/auth";
import { fetchEjercicios, createEjercicio, updateEjercicio, deleteEjercicio } from "@/api/ejercicios";

export function EjerciciosPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [selectedEjercicio, setSelectedEjercicio] = useState<Ejercicio | null>(null);
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
        setError(err instanceof Error ? err.message : "Error loading ejercicios");
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
      } else {
        // Create new
        savedEjercicio = await createEjercicio({
          nombre: formData.nombre,
          grupoMuscular: formData.grupoMuscular,
          descripcion: formData.descripcion || undefined,
        });

        // Add to list
        setEjercicios(prev => [...prev, savedEjercicio]);
      }

      // Reset form
      setSelectedEjercicio(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al guardar: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModify = (ejercicio: Ejercicio) => {
    setSelectedEjercicio(ejercicio);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteEjercicio(id);
      setEjercicios(prev => prev.filter(e => e.id !== id));
      if (selectedEjercicio?.id === id) {
        setSelectedEjercicio(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error deleting ejercicio";
      
      // Check if it's a referential integrity error
      if (errorMessage.includes("en uso") || errorMessage.includes("DELETE_BLOCKED")) {
        setError("No se puede eliminar: este ejercicio está en uso por una o más rutinas");
      } else {
        setError(errorMessage);
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
    <div className="flex flex-col gap-4 p-6">
      {/* Page title */}
      <h1 className="text-3xl font-bold">Ejercicios</h1>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-500">Cargando ejercicios...</p>
        </div>
      )}

      {/* Main content - two column layout */}
      {!loading && (
        <div className="flex gap-6">
          {/* Form panel - left */}
          <div className="w-96 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h2 className="font-bold text-lg">
                {selectedEjercicio ? "Editar Ejercicio" : "Nuevo Ejercicio"}
              </h2>
            </div>
            <EjercicioForm
              onSave={handleSave}
              initialData={selectedEjercicio}
              isLoading={isSaving}
            />
          </div>

          {/* List panel - right */}
          <div className="flex-1 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h2 className="font-bold text-lg">Ejercicios Disponibles</h2>
            </div>
            <EjercicioListPanel
              ejercicios={ejercicios}
              onModify={handleModify}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
