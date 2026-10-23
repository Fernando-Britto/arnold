import React, { useMemo, useState } from "react";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableDetailRow,
  compareSortValues,
  normalizeSortText,
  toggleSort,
  type TableColumn,
  type TableSort,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";
import { EjercicioDetalle } from "./ejercicio-detalle";
import { EjercicioMiniatura } from "./ejercicio-media";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const EJERCICIO_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "grupo", label: "Grupo", width: 118, sortable: true },
  { key: "rutinas", label: "Rutinas", width: 130 },
  { key: "estado", label: "Estado", width: 102 },
];

/** "En 3 rutinas" / "En 1 rutina"; "—" cuando ninguna la usa (se puede borrar). */
function usoEnRutinas(enRutinas: number): string {
  if (enRutinas <= 0) return "—";
  return `En ${enRutinas} ${enRutinas === 1 ? "rutina" : "rutinas"}`;
}

/** Sortable value per column, normalized for a case/accent-insensitive compare (H-7). */
function ejercicioSortValue(ejercicio: EjercicioConUso, key: string): string | number {
  switch (key) {
    case "grupo":
      return normalizeSortText(ejercicio.grupoMuscular);
    case "nombre":
    default:
      return normalizeSortText(ejercicio.nombre);
  }
}

/** Cuántos ejercicios se dibujan de una vez: el catálogo tiene más de 1.300 (D-70). */
const POR_PAGINA = 50;

const SELECT_CLASES = "rounded border border-border bg-surface px-3 py-2 text-sm text-ink-soft";

/** Valores distintos, sin vacíos y ordenados sin tildes (para las opciones de un filtro). */
function opcionesDe(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort((a, b) =>
    compareSortValues(normalizeSortText(a), normalizeSortText(b))
  );
}

export interface EjercicioListPanelProps {
  ejercicios: EjercicioConUso[];
  selectedId?: string | null;
  onSelect?: (ejercicio: EjercicioConUso) => void;
  searchTerm?: string;
}

/**
 * Presentational table for Ejercicios. Selection is controlled by the page;
 * the search term is filtered here (the input lives in the ActionBar).
 */
export function EjercicioListPanel({
  ejercicios,
  selectedId = null,
  onSelect,
  searchTerm = "",
}: EjercicioListPanelProps) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [grupo, setGrupo] = useState("");
  const [equipamiento, setEquipamiento] = useState("");
  const [paginacion, setPaginacion] = useState({ clave: "", limite: POR_PAGINA });

  const grupos = useMemo(() => opcionesDe(ejercicios.map((e) => e.grupoMuscular)), [ejercicios]);
  const equipamientos = useMemo(() => opcionesDe(ejercicios.map((e) => e.equipamiento)), [ejercicios]);
  const hayMedia = useMemo(() => ejercicios.some((e) => e.mediaId), [ejercicios]);

  const filtered = useMemo(() => {
    // H12: se pliega mayúsculas y tildes con `normalizeSortText` (el mismo helper que
    // usan las listas de rutinas), así "triceps" encuentra "Tríceps".
    const term = normalizeSortText(searchTerm.trim());
    const rows = ejercicios.filter(
      (e) =>
        (!grupo || e.grupoMuscular === grupo) &&
        (!equipamiento || e.equipamiento === equipamiento) &&
        (!term ||
          normalizeSortText(e.nombre).includes(term) ||
          normalizeSortText(e.grupoMuscular).includes(term) ||
          normalizeSortText(e.equipamiento ?? "").includes(term) ||
          normalizeSortText(e.musculoObjetivo ?? "").includes(term))
    );
    // H-7: mismo orden por columna que las otras listas (helper compartido de table.tsx).
    // Sin orden explícito se conserva el orden por nombre ascendente.
    const key = sort?.key ?? "nombre";
    const direction = sort?.direction ?? "asc";
    return rows.sort((a, b) => {
      const cmp = compareSortValues(ejercicioSortValue(a, key), ejercicioSortValue(b, key));
      return direction === "asc" ? cmp : -cmp;
    });
  }, [ejercicios, searchTerm, sort, grupo, equipamiento]);

  const handleSort = (key: string) => setSort((current) => toggleSort(current, key));

  // Paginación: al cambiar búsqueda, filtros u orden se vuelve a la primera página. Se deriva de una
  // clave (en vez de un efecto) para no renderizar dos veces. El seleccionado nunca queda oculto.
  const clave = `${searchTerm}|${grupo}|${equipamiento}|${sort?.key}|${sort?.direction}`;
  const limite = paginacion.clave === clave ? paginacion.limite : POR_PAGINA;
  const indiceSeleccionado = filtered.findIndex((e) => e.id === selectedId);
  const visibles = filtered.slice(0, Math.max(limite, indiceSeleccionado + 1));
  const hayFiltros = grupo !== "" || equipamiento !== "";

  if (ejercicios.length === 0) {
    return <div className="p-8 text-center text-sm text-ink-muted">No hay ejercicios</div>;
  }

  return (
    <>
      {(grupos.length > 1 || equipamientos.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-6 py-3">
          {grupos.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Grupo muscular
              <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={SELECT_CLASES}>
                <option value="">Todos los grupos</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {equipamientos.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Equipamiento
              <select value={equipamiento} onChange={(e) => setEquipamiento(e.target.value)} className={SELECT_CLASES}>
                <option value="">Todo el equipamiento</option>
                {equipamientos.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <Table label="Ejercicios">
        <TableHeader columns={EJERCICIO_COLUMNS} sort={sort} onSort={handleSort} disclosure />
        {visibles.map((ejercicio) => {
          const isSelected = ejercicio.id === selectedId;
          return (
            <React.Fragment key={ejercicio.id}>
              <TableRow selected={isSelected} onClick={() => onSelect?.(ejercicio)} disclosure>
                <TableCell width={100} variant="secondary">
                  {shortId("EX", ejercicio.id)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-3">
                    {hayMedia && <EjercicioMiniatura mediaId={ejercicio.mediaId} />}
                    {ejercicio.nombre}
                  </span>
                </TableCell>
                <TableCell width={118} variant="secondary">
                  {ejercicio.grupoMuscular}
                </TableCell>
                <TableCell width={130} variant="secondary">
                  {usoEnRutinas(ejercicio.enRutinas)}
                </TableCell>
                <TableCell width={102} variant="secondary">
                  {/* El modelo no tiene estado: se deja vacío, no se inventa dato. */}
                  —
                </TableCell>
              </TableRow>
              {isSelected && (
                <TableDetailRow>
                  <EjercicioDetalle ejercicio={ejercicio} />
                </TableDetailRow>
              )}
            </React.Fragment>
          );
        })}
        {filtered.length === 0 && searchTerm.trim() !== "" && (
          <p className="p-6 text-center text-sm text-ink-muted">
            {`No se encontraron ejercicios que coincidan con "${searchTerm}".`}
          </p>
        )}
        {filtered.length === 0 && searchTerm.trim() === "" && hayFiltros && (
          <p className="p-6 text-center text-sm text-ink-muted">No hay ejercicios con esos filtros.</p>
        )}
      </Table>
      {filtered.length > POR_PAGINA && (
        <div className="flex items-center justify-center gap-4 p-4 text-sm text-ink-muted">
          <span>{`Mostrando ${visibles.length} de ${filtered.length} ejercicios`}</span>
          {visibles.length < filtered.length && (
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
    </>
  );
}
