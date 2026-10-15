import React, { useMemo } from "react";
import { Ejercicio } from "@prisma/client";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableDetailRow,
  normalizeSortText,
  type TableColumn,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const EJERCICIO_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre" },
  { key: "grupo", label: "Grupo", width: 118 },
  { key: "estado", label: "Estado", width: 102 },
];

export interface EjercicioListPanelProps {
  ejercicios: Ejercicio[];
  selectedId?: string | null;
  onSelect?: (ejercicio: Ejercicio) => void;
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
  const filtered = useMemo(() => {
    // H12: se pliega mayúsculas y tildes con `normalizeSortText` (el mismo helper que
    // usan las listas de rutinas), así "triceps" encuentra "Tríceps".
    const term = normalizeSortText(searchTerm.trim());
    return [...ejercicios]
      .filter(
        (e) =>
          !term ||
          normalizeSortText(e.nombre).includes(term) ||
          normalizeSortText(e.grupoMuscular).includes(term)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ejercicios, searchTerm]);

  if (ejercicios.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay ejercicios</div>;
  }

  return (
    <Table label="Ejercicios">
      <TableHeader columns={EJERCICIO_COLUMNS} disclosure />
      {filtered.map((ejercicio) => {
        const isSelected = ejercicio.id === selectedId;
        return (
          <React.Fragment key={ejercicio.id}>
            <TableRow selected={isSelected} onClick={() => onSelect?.(ejercicio)} disclosure>
              <TableCell width={100} variant="secondary">
                {shortId("EX", ejercicio.id)}
              </TableCell>
              <TableCell>{ejercicio.nombre}</TableCell>
              <TableCell width={118} variant="secondary">
                {ejercicio.grupoMuscular}
              </TableCell>
              <TableCell width={102} variant="secondary">
                {/* El modelo no tiene estado: se deja vacío, no se inventa dato. */}
                —
              </TableCell>
            </TableRow>
            {isSelected && (
              <TableDetailRow>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Descripción</p>
                  <p className="text-sm text-[#333333]">{ejercicio.descripcion || "-"}</p>
                </div>
              </TableDetailRow>
            )}
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && searchTerm.trim() !== "" && (
        <p className="p-6 text-center text-sm text-[#71717A]">
          {`No se encontraron ejercicios que coincidan con "${searchTerm}".`}
        </p>
      )}
    </Table>
  );
}
