"use client";

import React, { useState, useMemo } from "react";
import type { Membresia } from "@/domains/membresia/membresia";

interface MembresiaWithCount extends Membresia {
  assignedSocioCount: number;
}

interface MembresiaListProps {
  membresias: MembresiaWithCount[];
  onEdit: (membresia: MembresiaWithCount) => void;
  onDelete: (id: string) => void;
  sortField?: "nombre" | "precio" | "periodicidad" | "estado";
  onSortChange?: (field: "nombre" | "precio" | "periodicidad" | "estado") => void;
}

type SortField = "nombre" | "precio" | "periodicidad" | "estado";
type SortOrder = "asc" | "desc";

export function MembresiaList({
  membresias,
  onEdit,
  onDelete,
  sortField: propSortField,
  onSortChange,
}: MembresiaListProps) {
  const [localSortField, setLocalSortField] = useState<SortField>("nombre");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Use prop sortField if provided, otherwise use local state
  const sortField = propSortField || localSortField;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Handle sort header click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      if (onSortChange) {
        onSortChange(field); // Notify parent
      } else {
        setLocalSortField(field); // Use local state if no parent callback
      }
      setSortOrder("asc");
    }
  };

  // Sort membresias
  const sortedMembresias = useMemo(() => {
    const sorted = [...membresias].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "nombre":
          compareValue = a.nombre.localeCompare(b.nombre, "es");
          break;
        case "precio":
          compareValue = a.precio - b.precio;
          break;
        case "periodicidad":
          compareValue = a.periodicidad - b.periodicidad;
          break;
        case "estado":
          compareValue = a.estado.localeCompare(b.estado);
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return sorted;
  }, [membresias, sortField, sortOrder]);

  if (membresias.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No hay membresías disponibles</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th
                onClick={() => handleSort("nombre")}
                className="border border-gray-200 px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Nombre{" "}
                {sortField === "nombre" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("precio")}
                className="border border-gray-200 px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Precio{" "}
                {sortField === "precio" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("periodicidad")}
                className="border border-gray-200 px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Periodicidad{" "}
                {sortField === "periodicidad" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Descripción
              </th>
              <th
                onClick={() => handleSort("estado")}
                className="border border-gray-200 px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Estado{" "}
                {sortField === "estado" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="border border-gray-200 px-4 py-2 text-left font-semibold">
                Miembros
              </th>
              <th className="border border-gray-200 px-4 py-2 text-center font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembresias.map((membresia) => {
              const isDeleteDisabled = membresia.assignedSocioCount > 0;

              return (
                <tr key={membresia.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-2">
                    {membresia.nombre}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    ARS {membresia.precio.toFixed(2)}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {membresia.periodicidad} días
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">
                    {membresia.descripcion || "-"}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        membresia.estado === "ACTIVA"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {membresia.estado === "ACTIVA" ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-center">
                    {membresia.assignedSocioCount}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-center space-x-2 flex justify-center">
                    <button
                      onClick={() => onEdit(membresia)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Editar
                    </button>
                    <div className="relative group">
                      <button
                        onClick={() => {
                          if (!isDeleteDisabled) {
                            setDeleteConfirmId(membresia.id);
                          }
                        }}
                        disabled={isDeleteDisabled}
                        className={`px-3 py-1 rounded text-sm ${
                          isDeleteDisabled
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        Eliminar
                      </button>
                      {isDeleteDisabled && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Esta membresía está asignada a socios y no se puede eliminar
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              ¿Eliminar membresía?
            </h3>
            <p className="text-gray-600 mb-6">
              Esta acción no se puede deshacer. ¿Está seguro?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
