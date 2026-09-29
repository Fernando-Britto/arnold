import React, { useState, useMemo } from "react";
import { Ejercicio } from "@prisma/client";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("nombre");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredAndSorted = useMemo(() => {
    let filtered = ejercicios;
    if (debouncedSearch) {
      filtered = ejercicios.filter(
        (e) =>
          e.nombre.toLowerCase().includes(debouncedSearch) ||
          e.grupoMuscular.toLowerCase().includes(debouncedSearch)
      );
    }
    return [...filtered].sort((a, b) => {
      const aValue = sortColumn === "nombre" ? a.nombre : a.grupoMuscular;
      const bValue = sortColumn === "nombre" ? b.nombre : b.grupoMuscular;
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [ejercicios, debouncedSearch, sortColumn, sortDirection]);

  const handleColumnClick = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = (ejercicio: Ejercicio) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(`¿Está seguro que desea eliminar "${ejercicio.nombre}"?`)
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
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
        <Search size={16} className="text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o grupo muscular..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-zinc-100 text-left text-[11px] font-bold text-zinc-500">
              <th
                className="cursor-pointer px-4 py-2 hover:bg-zinc-200"
                onClick={() => handleColumnClick("nombre")}
              >
                Nombre {sortColumn === "nombre" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-2 hover:bg-zinc-200"
                onClick={() => handleColumnClick("grupoMuscular")}
              >
                Grupo Muscular {sortColumn === "grupoMuscular" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th className="w-10 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((ejercicio) => {
              const isExpanded = expandedIds.has(ejercicio.id);
              return (
                <React.Fragment key={ejercicio.id}>
                  <tr
                    className={`cursor-pointer border-b hover:bg-zinc-50 ${
                      isExpanded ? "bg-[#FDEDE4]" : ""
                    }`}
                    onClick={() => toggleExpanded(ejercicio.id)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{ejercicio.nombre}</td>
                    <td className="px-4 py-3 text-zinc-600">{ejercicio.grupoMuscular}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        aria-label={`Ver detalle de ${ejercicio.nombre}`}
                        aria-expanded={isExpanded}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(ejercicio.id);
                        }}
                        className="text-zinc-400"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b bg-[#FDEDE4]">
                      <td colSpan={3} className="px-6 py-4">
                        <div className="flex items-center justify-between gap-6">
                          <div>
                            <p className="text-[11px] font-bold text-zinc-400">DESCRIPCIÓN</p>
                            <p className="text-sm text-zinc-900">{ejercicio.descripcion || "-"}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => onModify(ejercicio)}
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-[#C13D00] hover:bg-zinc-50"
                            >
                              Modificar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(ejercicio)}
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-[#C13D00] hover:bg-zinc-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && searchTerm && (
        <p className="text-center text-gray-500">
          No se encontraron ejercicios que coincidan con "{searchTerm}"
        </p>
      )}
    </div>
  );
}
