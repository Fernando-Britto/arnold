import React, { useState, useMemo } from "react";
import { type RutinaWithCount } from "@/api/rutinas";

type SortColumn = "nombre" | "objetivo" | "frecuencia" | "duracion" | "nivel";
type SortDirection = "asc" | "desc";

export interface RutinaListPanelProps {
  rutinas: RutinaWithCount[];
  onModify: (rutina: RutinaWithCount) => void;
  onDelete: (id: string) => void;
}

export function RutinaListPanel({
  rutinas,
  onModify,
  onDelete,
}: RutinaListPanelProps) {
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

  // Filter and sort rutinas
  const filteredAndSorted = useMemo(() => {
    let filtered = rutinas;

    // Filter by search term with safe optional chaining
    if (debouncedSearch) {
      filtered = rutinas.filter(
        (r) =>
          (r.nombre?.toLowerCase() ?? "").includes(debouncedSearch) ||
          (r.objetivoPrincipal?.toLowerCase() ?? "").includes(debouncedSearch)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortColumn === "nombre") {
        aValue = a.nombre || "";
        bValue = b.nombre || "";
      } else if (sortColumn === "objetivo") {
        aValue = a.objetivoPrincipal || "";
        bValue = b.objetivoPrincipal || "";
      } else if (sortColumn === "frecuencia") {
        aValue = a.frecuenciaSemanal;
        bValue = b.frecuenciaSemanal;
      } else if (sortColumn === "duracion") {
        aValue = a.duracionEstimada;
        bValue = b.duracionEstimada;
      } else {
        aValue = a.nivelDeDificultad || "";
        bValue = b.nivelDeDificultad || "";
      }

      if (typeof aValue === "string") {
        const comparison = (aValue as string).localeCompare(
          bValue as string
        );
        return sortDirection === "asc" ? comparison : -comparison;
      } else {
        const comparison = (aValue as number) - (bValue as number);
        return sortDirection === "asc" ? comparison : -comparison;
      }
    });

    return sorted;
  }, [rutinas, debouncedSearch, sortColumn, sortDirection]);

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

  const handleDelete = (rutina: RutinaWithCount) => {
    if (
      global.confirm(`¿Está seguro que desea eliminar "${rutina.nombre}"?`)
    ) {
      onDelete(rutina.id);
    }
  };

  if (rutinas.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No hay rutinas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Search input */}
      <input
        type="text"
        placeholder="Buscar por nombre u objetivo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th
                onClick={() => handleColumnClick("nombre")}
                className="px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Nombre{" "}
                {sortColumn === "nombre" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleColumnClick("objetivo")}
                className="px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Objetivo{" "}
                {sortColumn === "objetivo" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleColumnClick("frecuencia")}
                className="px-4 py-2 text-center font-semibold cursor-pointer hover:bg-gray-200"
              >
                Frecuencia{" "}
                {sortColumn === "frecuencia" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleColumnClick("duracion")}
                className="px-4 py-2 text-center font-semibold cursor-pointer hover:bg-gray-200"
              >
                Duración{" "}
                {sortColumn === "duracion" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleColumnClick("nivel")}
                className="px-4 py-2 text-left font-semibold cursor-pointer hover:bg-gray-200"
              >
                Nivel{" "}
                {sortColumn === "nivel" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-2 text-center font-semibold">
                Ejercicios
              </th>
              <th className="px-4 py-2 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((rutina, idx) => (
              <tr
                key={rutina.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2 border-b border-gray-200">
                  {rutina.nombre}
                </td>
                <td className="px-4 py-2 border-b border-gray-200">
                  {rutina.objetivoPrincipal || "-"}
                </td>
                <td className="px-4 py-2 border-b border-gray-200 text-center">
                  {rutina.frecuenciaSemanal}x/sem
                </td>
                <td className="px-4 py-2 border-b border-gray-200 text-center">
                  {rutina.duracionEstimada} min
                </td>
                <td className="px-4 py-2 border-b border-gray-200">
                  {rutina.nivelDeDificultad || "-"}
                </td>
                <td className="px-4 py-2 border-b border-gray-200 text-center font-semibold">
                  {rutina._count?.ejercicios ?? 0}
                </td>
                <td className="px-4 py-2 border-b border-gray-200 text-center">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => onModify(rutina)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-sm font-medium"
                      aria-label="editar"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(rutina)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium"
                      aria-label="eliminar"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
