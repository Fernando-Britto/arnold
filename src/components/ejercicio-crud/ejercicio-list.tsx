import React, { useState, useMemo, useCallback } from "react";
import { Ejercicio } from "@prisma/client";

type SortColumn = "nombre" | "grupoMuscular";
type SortDirection = "asc" | "desc";

export interface EjercicioListPanelProps {
  ejercicios: Ejercicio[];
  onModify: (ejercicio: Ejercicio) => void;
  onDelete: (id: string) => void;
}

export function EjercicioListPanel({
  ejercicios,
  onModify,
  onDelete,
}: EjercicioListPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("nombre");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.toLowerCase());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter and sort ejercicios
  const filteredAndSorted = useMemo(() => {
    let filtered = ejercicios;

    // Filter by search term
    if (debouncedSearch) {
      filtered = ejercicios.filter(
        e =>
          e.nombre.toLowerCase().includes(debouncedSearch) ||
          e.grupoMuscular.toLowerCase().includes(debouncedSearch)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortColumn === "nombre") {
        aValue = a.nombre;
        bValue = b.nombre;
      } else {
        aValue = a.grupoMuscular;
        bValue = b.grupoMuscular;
      }

      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [ejercicios, debouncedSearch, sortColumn, sortDirection]);

  const handleColumnClick = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDelete = (ejercicio: Ejercicio) => {
    if (
      global.confirm(
        `¿Está seguro que desea eliminar "${ejercicio.nombre}"?`
      )
    ) {
      onDelete(ejercicio.id);
    }
  };

  if (ejercicios.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No hay ejercicios</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Search input */}
      <input
        type="text"
        placeholder="Buscar por nombre o grupo muscular..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="block w-full rounded border border-gray-300 px-3 py-2"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-100">
              <th
                className="cursor-pointer px-4 py-2 text-left font-medium hover:bg-gray-200"
                onClick={() => handleColumnClick("nombre")}
              >
                Nombre {sortColumn === "nombre" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-2 text-left font-medium hover:bg-gray-200"
                onClick={() => handleColumnClick("grupoMuscular")}
              >
                Grupo Muscular {sortColumn === "grupoMuscular" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                Descripción
              </th>
              <th className="px-4 py-2 text-center font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(ejercicio => (
              <tr key={ejercicio.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{ejercicio.nombre}</td>
                <td className="px-4 py-2">{ejercicio.grupoMuscular}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {ejercicio.descripcion || "-"}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onModify(ejercicio)}
                    className="mr-2 rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
                  >
                    Modificar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ejercicio)}
                    className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results message */}
      {filteredAndSorted.length === 0 && searchTerm && (
        <p className="text-center text-gray-500">
          No se encontraron ejercicios que coincidan con "{searchTerm}"
        </p>
      )}
    </div>
  );
}
