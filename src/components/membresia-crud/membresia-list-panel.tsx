"use client";

import React, { useMemo } from "react";
import type { Membresia } from "@/domains/membresia/membresia";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableStatusBadge,
  TableDetailRow,
  type TableColumn,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";
import { formatMoney } from "@/utils/formatting";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const MEMBRESIA_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre" },
  { key: "precio", label: "Precio", width: 120 },
  { key: "periodicidad", label: "Periodicidad", width: 150 },
  { key: "estado", label: "Estado", width: 100 },
];

export interface MembresiaListPanelProps {
  membresias: Membresia[];
  selectedId?: string | null;
  onSelect?: (membresia: Membresia) => void;
  searchTerm?: string;
  isLoading?: boolean;
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
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...membresias]
      .filter((m) => !term || m.nombre.toLowerCase().includes(term))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [membresias, searchTerm]);

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-[#71717A]">Cargando membresías...</div>;
  }

  if (membresias.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay membresías</div>;
  }

  return (
    <Table label="Membresías">
      <TableHeader columns={MEMBRESIA_COLUMNS} />
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
