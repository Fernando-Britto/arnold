import React, { useMemo, useState } from "react";
import { type RutinaWithCount } from "@/api/rutinas";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableDetailRow,
  toggleSort,
  compareSortValues,
  normalizeSortText,
  type TableColumn,
  type TableSort,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const RUTINA_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 80 },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "ejercicios", label: "Ejercicios", width: 100, align: "center", sortable: true },
  { key: "frecuencia", label: "Frec/Sem", width: 100, align: "center", sortable: true },
  { key: "nivel", label: "Nivel", width: 120, sortable: true },
  { key: "estado", label: "Estado", width: 120 },
];

const NIVEL_LABEL: Record<string, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

function nivelLabel(nivel?: string | null): string {
  if (!nivel) return "";
  return NIVEL_LABEL[nivel] ?? nivel;
}

/** Sortable value per column, normalized for a case/accent-insensitive compare. */
function rutinaSortValue(rutina: RutinaWithCount, key: string): string | number {
  switch (key) {
    case "ejercicios":
      return rutina._count?.ejercicios ?? 0;
    case "frecuencia":
      return rutina.frecuenciaSemanal ?? 0;
    case "nivel":
      return normalizeSortText(nivelLabel(rutina.nivelDeDificultad));
    case "nombre":
    default:
      return normalizeSortText(rutina.nombre ?? "");
  }
}

export interface RutinaListPanelProps {
  rutinas: RutinaWithCount[];
  selectedId?: string | null;
  onSelect?: (rutina: RutinaWithCount) => void;
  searchTerm?: string;
}

/**
 * Presentational table for Rutinas. Selection is controlled by the page;
 * the search term is filtered here (the input lives in the ActionBar).
 */
export function RutinaListPanel({
  rutinas,
  selectedId = null,
  onSelect,
  searchTerm = "",
}: RutinaListPanelProps) {
  const [sort, setSort] = useState<TableSort | null>(null);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = rutinas.filter(
      (r) =>
        !term ||
        (r.nombre?.toLowerCase() ?? "").includes(term) ||
        (r.objetivoPrincipal?.toLowerCase() ?? "").includes(term)
    );
    // Sin orden explícito se conserva el orden por defecto (nombre asc).
    const key = sort?.key ?? "nombre";
    const direction = sort?.direction ?? "asc";
    return rows.sort((a, b) => {
      const cmp = compareSortValues(rutinaSortValue(a, key), rutinaSortValue(b, key));
      return direction === "asc" ? cmp : -cmp;
    });
  }, [rutinas, searchTerm, sort]);

  const handleSort = (key: string) => setSort((current) => toggleSort(current, key));

  if (rutinas.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay rutinas</div>;
  }

  return (
    <Table label="Rutinas">
      <TableHeader columns={RUTINA_COLUMNS} sort={sort} onSort={handleSort} />
      {filtered.map((rutina) => {
        const isSelected = rutina.id === selectedId;
        return (
          <React.Fragment key={rutina.id}>
            <TableRow selected={isSelected} onClick={() => onSelect?.(rutina)}>
              <TableCell width={80} variant="secondary">
                {shortId("RU", rutina.id)}
              </TableCell>
              <TableCell>{rutina.nombre}</TableCell>
              <TableCell width={100} align="center" variant="secondary">
                {rutina._count?.ejercicios ?? 0}
              </TableCell>
              <TableCell width={100} align="center" variant="secondary">
                {rutina.frecuenciaSemanal}x/sem
              </TableCell>
              <TableCell width={120} variant="secondary">
                {rutina.nivelDeDificultad
                  ? NIVEL_LABEL[rutina.nivelDeDificultad] ?? rutina.nivelDeDificultad
                  : "-"}
              </TableCell>
              <TableCell width={120} variant="secondary">
                {/* El modelo no tiene estado: se deja vacío, no se inventa dato. */}
                —
              </TableCell>
            </TableRow>
            {isSelected && (
              <TableDetailRow>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Objetivo</p>
                  <p className="text-sm text-[#333333]">{rutina.objetivoPrincipal || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Descripción</p>
                  <p className="text-sm text-[#333333]">{rutina.descripcion || "-"}</p>
                </div>
              </TableDetailRow>
            )}
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && searchTerm.trim() !== "" && (
        <p className="p-6 text-center text-sm text-[#71717A]">
          {`No se encontraron rutinas que coincidan con "${searchTerm}".`}
        </p>
      )}
    </Table>
  );
}
