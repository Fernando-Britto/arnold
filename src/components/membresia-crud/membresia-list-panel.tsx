"use client";

import React, { useState, useEffect } from "react";
import { MembresiaList } from "./membresia-list";
import type { Membresia } from "@/domains/membresia/membresia";

interface MembresiaListPanelProps {
  onEditClick?: (membresia: MembresiaWithCount) => void;
  activeOnly?: boolean;
}

interface MembresiaWithCount extends Membresia {
  assignedSocioCount: number;
}

export function MembresiaListPanel({
  onEditClick,
  activeOnly = false,
}: MembresiaListPanelProps) {
  const [membresias, setMembresias] = useState<MembresiaWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"nombre" | "precio" | "periodicidad" | "estado">("nombre");

  // Fetch list on mount
  useEffect(() => {
    fetchMembresias();
  }, [activeOnly]);

  const fetchMembresias = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = activeOnly ? "/api/membresias?activeOnly=true" : "/api/membresias";
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron cargar las membresías`);
      }

      const data = await response.json();
      setMembresias(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Confirmation is handled by MembresiaList modal — no need for window.confirm() here
    setDeleteError(null);

    try {
      const response = await fetch(`/api/membresias/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();

        // Handle AC-006: delete blocking
        if (data.code === "DELETE_BLOCKED_ASSIGNED") {
          setDeleteError(
            `No se puede eliminar: ${data.message}`
          );
          return;
        }

        throw new Error(data.message || "Error al eliminar membresía");
      }

      // Remove from list
      setMembresias((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  const handleRefresh = () => {
    fetchMembresias();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
          <button
            onClick={handleRefresh}
            className="ml-2 inline underline font-semibold hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {deleteError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-4 pb-4 border-b">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700">
            Ordenar por:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "nombre" | "precio" | "estado")}
            className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm"
          >
            <option value="nombre">Nombre</option>
            <option value="precio">Precio</option>
            <option value="estado">Estado</option>
          </select>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* List */}
      {isLoading && membresias.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Cargando membresías...</div>
      ) : membresias.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No hay membresías</div>
      ) : (
        <MembresiaList
          membresias={membresias}
          sortField={sortBy}
          onSortChange={setSortBy}
          onEdit={onEditClick || (() => {})}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
