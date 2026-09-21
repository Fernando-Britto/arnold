import React, { useState, useCallback } from "react";
import { Ejercicio } from "@prisma/client";
import { formatDescansoDisplay, parseDescansoInput } from "./descanso-utils";

/**
 * Represents an ejercicio being added to a rutina (before persisting to DB)
 */
export interface EjercicioEnRutinaRow {
  ejercicioId: string;
  ejercicioNombre: string;
  series: number;
  repeticiones: number;
  descanso: number; // stored as seconds
}

export interface EjercicioEnRutinaListProps {
  rows: EjercicioEnRutinaRow[];
  availableEjercicios: Ejercicio[];
  onRowsChange: (rows: EjercicioEnRutinaRow[]) => void;
}

/**
 * Modal for selecting exercises from the catalog
 */
function CatalogModal({
  isOpen,
  ejercicios,
  selectedIds,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  ejercicios: Ejercicio[];
  selectedIds: Set<string>;
  onSelect: (ejercicioIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedInModal, setSelectedInModal] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleCheckChange = (ejercicioId: string) => {
    const newSelected = new Set(selectedInModal);
    if (newSelected.has(ejercicioId)) {
      newSelected.delete(ejercicioId);
    } else {
      newSelected.add(ejercicioId);
    }
    setSelectedInModal(newSelected);
  };

  const handleAdd = () => {
    onSelect(Array.from(selectedInModal));
    setSelectedInModal(new Set());
    setSearchTerm("");
    onClose();
  };

  const filteredEjercicios = ejercicios.filter(ejercicio =>
    ejercicio.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto flex flex-col">
        <h2 className="text-lg font-semibold mb-4">Agregar Ejercicios</h2>
        
        <input
          type="text"
          placeholder="Buscar ejercicio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="catalog-search"
        />
        
        {filteredEjercicios.length === 0 ? (
          <p className="text-gray-500">{searchTerm ? "No se encontraron ejercicios" : "No hay ejercicios disponibles"}</p>
        ) : (
          <div className="space-y-2 mb-4 overflow-y-auto flex-1">
            {filteredEjercicios.map(ejercicio => (
              <label
                key={ejercicio.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedInModal.has(ejercicio.id)}
                  onChange={() => handleCheckChange(ejercicio.id)}
                  disabled={selectedIds.has(ejercicio.id)}
                  className="w-4 h-4"
                />
                <span className="flex-1">
                  <span className="font-medium">{ejercicio.nombre}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({ejercicio.grupoMuscular})
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedInModal.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Agregar ({selectedInModal.size})
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * EjercicioEnRutinaList component - manages exercises within a routine
 * Displays exercises as a table with inline editing for series, reps, and rest time
 */
export function EjercicioEnRutinaList({
  rows,
  availableEjercicios,
  onRowsChange,
}: EjercicioEnRutinaListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Track which ejercicio IDs are already in the table
  const selectedEjercicioIds = new Set(rows.map(r => r.ejercicioId));

  /**
   * Add selected exercises from catalog to the table with default values
   */
  const handleAddFromCatalog = useCallback(
    (ejercicioIds: string[]) => {
      const nuevosRows = ejercicioIds
        .map(ejercicioId => {
          // Check for duplicate
          if (selectedEjercicioIds.has(ejercicioId)) {
            return null;
          }

          const ejercicio = availableEjercicios.find(e => e.id === ejercicioId);
          if (!ejercicio) return null;

          return {
            ejercicioId,
            ejercicioNombre: ejercicio.nombre,
            series: 3,
            repeticiones: 10,
            descanso: 60,
          };
        })
        .filter((r): r is EjercicioEnRutinaRow => r !== null);

      onRowsChange([...rows, ...nuevosRows]);
    },
    [rows, availableEjercicios, selectedEjercicioIds, onRowsChange]
  );

  /**
   * Delete a row from the table
   */
  const handleDelete = useCallback(
    (index: number) => {
      const ejercicio = rows[index];
      if (
        global.confirm(
          `¿Eliminar "${ejercicio.ejercicioNombre}" de esta rutina?`
        )
      ) {
        onRowsChange(rows.filter((_, i) => i !== index));
      }
    },
    [rows, onRowsChange]
  );

  /**
   * Update a specific field in a row
   */
  const handleFieldChange = useCallback(
    (index: number, field: keyof EjercicioEnRutinaRow, value: unknown) => {
      const updated = [...rows];
      const row = updated[index];

      if (field === "descanso" && typeof value === "string") {
        // Parse descanso input (MM:SS or seconds)
        row.descanso = parseDescansoInput(value);
      } else if (field === "series" || field === "repeticiones") {
        const numValue = parseInt(String(value), 10);
        if (!isNaN(numValue) && numValue > 0) {
          (row[field] as number) = numValue;
        }
      }

      onRowsChange(updated);
    },
    [rows, onRowsChange]
  );

  const getAvailableEjercicios = () => {
    return availableEjercicios.filter(e => !selectedEjercicioIds.has(e.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ejercicios de la rutina</h3>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Agregar Ejercicio
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded">
          No hay ejercicios agregados aún
        </p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  NOMBRE
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-700 w-20">
                  SER.
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-700 w-20">
                  REPS.
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-700 w-24">
                  DESCANSO
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-700 w-16">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.ejercicioId}-${index}`}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  {/* Nombre (read-only) */}
                  <td className="px-4 py-2 text-gray-900">
                    {row.ejercicioNombre}
                  </td>

                  {/* Series (inline edit) */}
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min="1"
                      value={row.series}
                      onChange={e =>
                        handleFieldChange(index, "series", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-center"
                    />
                  </td>

                  {/* Repeticiones (inline edit) */}
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min="1"
                      value={row.repeticiones}
                      onChange={e =>
                        handleFieldChange(index, "repeticiones", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-center"
                    />
                  </td>

                  {/* Descanso (inline edit, MM:SS format) */}
                  <td className="px-4 py-2 text-center">
                    <input
                      type="text"
                      value={formatDescansoDisplay(row.descanso)}
                      onChange={e =>
                        handleFieldChange(index, "descanso", e.target.value)
                      }
                      placeholder="M:SS"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-center"
                    />
                  </td>

                  {/* Delete button */}
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Catalog Modal */}
      <CatalogModal
        isOpen={isModalOpen}
        ejercicios={getAvailableEjercicios()}
        selectedIds={selectedEjercicioIds}
        onSelect={handleAddFromCatalog}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
