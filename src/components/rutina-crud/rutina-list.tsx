import React, { useMemo } from "react";
import { type RutinaWithCount } from "@/api/rutinas";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableDetailRow,
  type TableColumn,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const RUTINA_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 80 },
  { key: "nombre", label: "Nombre" },
  { key: "ejercicios", label: "Ejercicios", width: 100, align: "center" },
  { key: "frecuencia", label: "Frec/Sem", width: 100, align: "center" },
  { key: "nivel", label: "Nivel", width: 120 },
  { key: "estado", label: "Estado", width: 120 },
];

const NIVEL_LABEL: Record<string, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

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
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...rutinas]
      .filter(
        (r) =>
          !term ||
          (r.nombre?.toLowerCase() ?? "").includes(term) ||
          (r.objetivoPrincipal?.toLowerCase() ?? "").includes(term)
      )
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
  }, [rutinas, searchTerm]);

  if (rutinas.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay rutinas</div>;
  }

  return (
    <Table label="Rutinas">
      <TableHeader columns={RUTINA_COLUMNS} />
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
