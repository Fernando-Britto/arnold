"use client";

import React, { useMemo, useState } from "react";
import type { Membresia } from "@/domains/membresia/membresia";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableStatusBadge,
  TableDetailRow,
  toggleSort,
  compareSortValues,
  normalizeSortText,
  type TableColumn,
  type TableSort,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";
import { formatMoney } from "@/utils/formatting";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const MEMBRESIA_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "precio", label: "Precio", width: 120, sortable: true },
  { key: "periodicidad", label: "Periodicidad", width: 150, sortable: true },
  { key: "estado", label: "Estado", width: 100, sortable: true },
  { key: "miembros", label: "Miembros", width: 100, align: "center" },
];

/**
 * Row shape for the management list: the domain record plus the live count of
 * socios with that membresía assigned (AC-007). The count is display-only and
 * deliberately not sortable.
 */
export interface MembresiaListItem extends Membresia {
  assignedSocioCount?: number;
}

export interface MembresiaListPanelProps {
  membresias: MembresiaListItem[];
  selectedId?: string | null;
  onSelect?: (membresia: MembresiaListItem) => void;
  searchTerm?: string;
  isLoading?: boolean;
}

/** Sortable value per column, normalized for a case/accent-insensitive compare. */
function membresiaSortValue(membresia: MembresiaListItem, key: string): string | number {
  switch (key) {
    case "precio":
      return Number(membresia.precio);
    case "periodicidad":
      return Number(membresia.periodicidad);
    case "estado":
      return normalizeSortText(membresia.estado === "ACTIVA" ? "Activa" : "Inactiva");
    case "nombre":
    default:
      return normalizeSortText(membresia.nombre ?? "");
  }
}

/**
 * Presentational table for Membresías. Selection is controlled by the page;
 * the search term is filtered here (the input lives in the ActionBar).
 */
export function MembresiaListPanel({
  membresias,
  selectedId = null,
  onSelect,
  searchTerm = "",
  isLoading = false,
}: MembresiaListPanelProps) {
  const [sort, setSort] = useState<TableSort | null>(null);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = membresias.filter((m) => !term || m.nombre.toLowerCase().includes(term));
    // Sin orden explícito se conserva el orden por defecto (nombre asc).
    const key = sort?.key ?? "nombre";
    const direction = sort?.direction ?? "asc";
    return rows.sort((a, b) => {
      const cmp = compareSortValues(
        membresiaSortValue(a, key),
        membresiaSortValue(b, key),
      );
      return direction === "asc" ? cmp : -cmp;
    });
  }, [membresias, searchTerm, sort]);

  const handleSort = (key: string) => setSort((current) => toggleSort(current, key));

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-[#71717A]">Cargando membresías...</div>;
  }

  if (membresias.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay membresías</div>;
  }

  return (
    <Table label="Membresías">
      <TableHeader columns={MEMBRESIA_COLUMNS} sort={sort} onSort={handleSort} />
      {filtered.map((membresia) => {
        const isSelected = membresia.id === selectedId;
        const isActiva = membresia.estado === "ACTIVA";
        return (
          <React.Fragment key={membresia.id}>
            <TableRow selected={isSelected} onClick={() => onSelect?.(membresia)}>
              <TableCell width={100} variant="secondary">
                {shortId("MB", membresia.id)}
              </TableCell>
              <TableCell>{membresia.nombre}</TableCell>
              <TableCell width={120} variant="secondary">
                {formatMoney(membresia.precio)}
              </TableCell>
              <TableCell width={150} variant="secondary">
                {membresia.periodicidad} días
              </TableCell>
              <TableCell width={100}>
                <TableStatusBadge variant={isActiva ? "success" : "neutral"}>
                  {isActiva ? "Activa" : "Inactiva"}
                </TableStatusBadge>
              </TableCell>
              <TableCell width={100} align="center" variant="secondary">
                {membresia.assignedSocioCount ?? 0}
              </TableCell>
            </TableRow>
            {isSelected && (
              <TableDetailRow>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Descripción</p>
                  <p className="text-sm text-[#333333]">{membresia.descripcion || "-"}</p>
                </div>
              </TableDetailRow>
            )}
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && searchTerm.trim() !== "" && (
        <p className="p-6 text-center text-sm text-[#71717A]">
          {`No se encontraron membresías que coincidan con "${searchTerm}".`}
        </p>
      )}
    </Table>
  );
}
