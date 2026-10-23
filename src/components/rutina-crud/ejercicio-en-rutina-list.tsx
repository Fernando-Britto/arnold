import React, { useState, useCallback, useMemo } from "react";
import type { EjercicioResumen } from "@/domains/ejercicio/ejercicio";
import type { EjercicioEnRutinaRow } from "@/api/rutinas";
import { filtrarEjercicios, opcionesDeFiltro } from "@/domains/ejercicio/busqueda";
import { AtribucionMedia, EjercicioMiniatura } from "@/components/ejercicio-crud/ejercicio-media";
import { formatDescansoDisplay, parseDescansoInput } from "./descanso-utils";

export interface EjercicioEnRutinaListProps {
  rows: EjercicioEnRutinaRow[];
  availableEjercicios: EjercicioResumen[];
  onRowsChange: (rows: EjercicioEnRutinaRow[]) => void;
}

/** Cuántos ejercicios se dibujan de una vez: el catálogo tiene más de 1.300 (D-70). */
const POR_PAGINA = 50;

const SELECT_CLASES = "rounded border border-border bg-surface px-3 py-2 text-sm text-ink-soft";

/**
 * Modal for selecting exercises from the catalog (T-052, D-72).
 *
 * Con el catálogo de 1.330 ejercicios: busca sin distinguir tildes y por varias palabras, filtra por
 * grupo muscular y equipamiento, muestra la miniatura de cada ejercicio (con la atribución de la
 * media) y dibuja de a 50. Lo que se tilda se conserva aunque cambie la búsqueda o el filtro.
 */
function CatalogModal({
  isOpen,
  ejercicios,
  selectedIds,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  ejercicios: EjercicioResumen[];
  selectedIds: Set<string>;
  onSelect: (ejercicioIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedInModal, setSelectedInModal] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [grupo, setGrupo] = useState("");
  const [equipamiento, setEquipamiento] = useState("");
  const [paginacion, setPaginacion] = useState({ clave: "", limite: POR_PAGINA });

  const grupos = useMemo(() => opcionesDeFiltro(ejercicios.map((e) => e.grupoMuscular)), [ejercicios]);
  const equipamientos = useMemo(() => opcionesDeFiltro(ejercicios.map((e) => e.equipamiento)), [ejercicios]);
  const hayMedia = useMemo(() => ejercicios.some((e) => e.mediaId), [ejercicios]);

  const filteredEjercicios = useMemo(
    () => filtrarEjercicios(ejercicios, { texto: searchTerm, grupo, equipamiento }),
    [ejercicios, searchTerm, grupo, equipamiento]
  );

  // Al cambiar la búsqueda o un filtro se vuelve a la primera página. Se deriva de una clave (en vez de
  // un efecto) para no renderizar dos veces.
  const clave = `${searchTerm}|${grupo}|${equipamiento}`;
  const limite = paginacion.clave === clave ? paginacion.limite : POR_PAGINA;
  const visibles = filteredEjercicios.slice(0, limite);
  const hayFiltros = grupo !== "" || equipamiento !== "";

  /** Cierra y deja el modal limpio: lo tildado y la búsqueda no se arrastran a la próxima vez que se abre. */
  const cerrar = () => {
    setSelectedInModal(new Set());
    setSearchTerm("");
    setGrupo("");
    setEquipamiento("");
    onClose();
  };

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
    cerrar();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") cerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalogo-titulo"
        className="bg-surface rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[85vh] flex flex-col"
      >
        <h2 id="catalogo-titulo" className="text-lg font-semibold mb-4 shrink-0">
          Agregar Ejercicios
        </h2>
        
        <input
          type="text"
          placeholder="Buscar ejercicio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Buscar ejercicio"
          autoFocus
          className="w-full px-3 py-2 border border-border rounded mb-3 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand"
          data-testid="catalog-search"
        />
        
        {(grupos.length > 1 || equipamientos.length > 0) && (
          <div className="flex flex-wrap items-center gap-4 mb-3 shrink-0">
            {grupos.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Grupo muscular
                <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={SELECT_CLASES}>
                  <option value="">Todos los grupos</option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {equipamientos.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Equipamiento
                <select
                  value={equipamiento}
                  onChange={(e) => setEquipamiento(e.target.value)}
                  className={SELECT_CLASES}
                >
                  <option value="">Todo el equipamiento</option>
                  {equipamientos.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {filteredEjercicios.length === 0 ? (
          <p className="text-ink-muted">
            {searchTerm.trim() !== ""
              ? "No se encontraron ejercicios"
              : hayFiltros
                ? "No hay ejercicios con esos filtros."
                : "No hay ejercicios disponibles"}
          </p>
        ) : (
          <div className="space-y-2 mb-4 overflow-y-auto flex-1 min-h-0">
            {visibles.map((ejercicio) => {
              return (
                <label
                  key={ejercicio.id}
                  className="flex items-center gap-3 p-2 hover:bg-surface-hover rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedInModal.has(ejercicio.id)}
                    onChange={() => handleCheckChange(ejercicio.id)}
                    disabled={selectedIds.has(ejercicio.id)}
                    className="w-4 h-4"
                  />
                  {hayMedia && <EjercicioMiniatura mediaId={ejercicio.mediaId} />}
                  <span className="flex-1">
                    <span className="font-medium">{ejercicio.nombre}</span>
                    <span className="text-sm text-ink-muted ml-2">
                      ({ejercicio.grupoMuscular}
                      {ejercicio.equipamiento ? ` · ${ejercicio.equipamiento}` : ""})
                    </span>
                  </span>
                </label>
              );
            })}
            {filteredEjercicios.length > POR_PAGINA && (
              <div className="flex items-center justify-center gap-4 p-2 text-sm text-ink-soft">
                <span>{`Mostrando ${visibles.length} de ${filteredEjercicios.length} ejercicios`}</span>
                {visibles.length < filteredEjercicios.length && (
                  <button
                    type="button"
                    onClick={() => setPaginacion({ clave, limite: limite + POR_PAGINA })}
                    className="rounded border border-border bg-surface px-3 py-2 font-medium text-ink-soft hover:bg-surface-subtle"
                  >
                    Ver más ejercicios
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {hayMedia && (
          <div className="shrink-0">
            <AtribucionMedia />
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4 shrink-0">
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 text-ink-soft border border-border rounded hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedInModal.size === 0}
            className="rounded bg-brand-strong px-4 py-2 text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
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
  const selectedEjercicioIds = useMemo(
    () => new Set(rows.map((r) => r.ejercicioId)),
    [rows]
  );

  /**
    * Add selected exercises from catalog to the table with default values
    */
  const handleAddFromCatalog = useCallback(
    (ejercicioIds: string[]) => {
      const startIndex = rows.length;
      const nuevosRows: EjercicioEnRutinaRow[] = [];
      
      for (let idx = 0; idx < ejercicioIds.length; idx++) {
        const ejercicioId = ejercicioIds[idx];
        
        // Check for duplicate
        if (selectedEjercicioIds.has(ejercicioId)) {
          continue;
        }

        const ejercicio = availableEjercicios.find(e => e.id === ejercicioId);
        if (!ejercicio) continue;

        nuevosRows.push({
          ejercicioId,
          ejercicioNombre: ejercicio.nombre,
          series: 3,
          repeticiones: 10,
          descanso: 60,
          orden: startIndex + nuevosRows.length,
        });
      }

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
        const updated = rows
          .filter((_, i) => i !== index)
          .map((row, i) => ({ ...row, orden: i }));
        onRowsChange(updated);
      }
    },
    [rows, onRowsChange]
  );

  /**
   * Update a specific field in a row
   */
  const handleFieldChange = useCallback(
    (index: number, field: keyof EjercicioEnRutinaRow, value: unknown) => {
      const updated = rows.map((row, i) => {
        if (i !== index) return row;
        const newRow = { ...row };

        if (field === "descanso" && typeof value === "string") {
          // Parse descanso input (MM:SS or seconds)
          newRow.descanso = parseDescansoInput(value);
        } else if (field === "series" || field === "repeticiones") {
          const numValue = parseInt(String(value), 10);
          if (!isNaN(numValue) && numValue > 0) {
            (newRow[field] as number) = numValue;
          }
        }
        return newRow;
      });

      onRowsChange(updated);
    },
    [rows, onRowsChange]
  );

  /**
   * Move a row up in the table (decrease index by 1)
   * Swaps with the previous row and recalculates orden for consistency
   */
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return; // Can't move first row up

      const updated = [...rows];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;

      // Recalculate orden for all rows to maintain consistency
      const normalized = updated.map((row, i) => ({
        ...row,
        orden: i,
      }));

      onRowsChange(normalized);
    },
    [rows, onRowsChange]
  );

  /**
   * Move a row down in the table (increase index by 1)
   * Swaps with the next row and recalculates orden for consistency
   */
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= rows.length - 1) return; // Can't move last row down

      const updated = [...rows];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;

      // Recalculate orden for all rows to maintain consistency
      const normalized = updated.map((row, i) => ({
        ...row,
        orden: i,
      }));

      onRowsChange(normalized);
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
          className="rounded bg-brand-strong px-3 py-1 text-sm text-surface hover:bg-brand-deep"
        >
          Agregar Ejercicio
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted p-4 border border-dashed border-border rounded">
          No hay ejercicios agregados aún
        </p>
      ) : (
        <div className="overflow-x-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-ink-soft">
                  NOMBRE
                </th>
                <th className="px-4 py-2 text-center font-medium text-ink-soft w-20">
                  SER.
                </th>
                <th className="px-4 py-2 text-center font-medium text-ink-soft w-20">
                  REPS.
                </th>
                 <th className="px-4 py-2 text-center font-medium text-ink-soft w-24">
                   DESCANSO
                 </th>
                 <th className="px-4 py-2 text-center font-medium text-ink-soft w-24">
                   ACCIONES
                 </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.ejercicioId}-${index}`}
                  className="border-b border-border hover:bg-surface-hover"
                >
                  {/* Nombre (read-only) */}
                  <td className="px-4 py-2 text-ink">
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
                      className="w-full border border-border rounded px-2 py-1 text-center"
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
                      className="w-full border border-border rounded px-2 py-1 text-center"
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
                      className="w-full border border-border rounded px-2 py-1 text-center"
                    />
                  </td>

                   {/* Move and Delete buttons */}
                   <td className="px-4 py-2 text-center flex gap-1 justify-center">
                     <button
                       type="button"
                       onClick={() => handleMoveUp(index)}
                       disabled={index === 0}
                       className="px-2 py-1 text-sm text-info hover:bg-info-soft rounded disabled:text-ink-disabled disabled:bg-surface-subtle disabled:cursor-not-allowed"
                       aria-label="Move row up"
                       data-testid={`move-up-${index}`}
                     >
                       ↑
                     </button>
                     <button
                       type="button"
                       onClick={() => handleMoveDown(index)}
                       disabled={index === rows.length - 1}
                       className="px-2 py-1 text-sm text-info hover:bg-info-soft rounded disabled:text-ink-disabled disabled:bg-surface-subtle disabled:cursor-not-allowed"
                       aria-label="Move row down"
                       data-testid={`move-down-${index}`}
                     >
                       ↓
                     </button>
                     <button
                       type="button"
                       onClick={() => handleDelete(index)}
                       className="px-2 py-1 text-sm text-danger hover:bg-danger-soft rounded"
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
