import React, { useMemo } from "react";
import { normalizeDNI, type EstadoCuenta } from "@/domains/cliente/cliente";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableStatusBadge,
  TableDetailRow,
  type TableColumn,
  type TableStatusVariant,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const CLIENTE_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 80 },
  { key: "nombre", label: "Nombre" },
  { key: "dni", label: "DNI", width: 120 },
  { key: "membresia", label: "Membresía", width: 180 },
  { key: "estadoCuota", label: "Estado de cuota", width: 140 },
];

export interface ClienteRow {
  id: string;
  nombre: string;
  dni: string;
  email: string;
  telefono?: string | null;
  membresiaAsignada: string;
  estadoCuenta: EstadoCuenta;
  fechaAlta: Date;
}

export interface ClienteListProps {
  clientes: ClienteRow[];
  selectedId?: string | null;
  onSelect?: (cliente: ClienteRow) => void;
  searchTerm?: string;
  membresiaLabels?: Record<string, string>;
  isLoading?: boolean;
}

function estadoCuentaVariant(estado: EstadoCuenta): TableStatusVariant {
  switch (estado) {
    case "Activo":
      return "success";
    case "Inactivo":
      return "warning";
    case "Bloqueado":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Presentational table for Clientes. Selection is controlled by the page;
 * the search term is filtered here (the input lives in the ActionBar).
 */
export function ClienteList({
  clientes,
  selectedId = null,
  onSelect,
  searchTerm = "",
  membresiaLabels = {},
  isLoading = false,
}: ClienteListProps) {
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // Los DNI se guardan sin puntos (normalizeDNI). Si el término es un DNI
    // (sólo dígitos y separadores), se compara normalizado para que "30.123.456"
    // encuentre "30123456". Para nombre/email se usa el término tal cual.
    const dniTerm = normalizeDNI(term);
    const isDniSearch = dniTerm.length > 0 && /^[\d.\s-]+$/.test(term);
    return [...clientes]
      .filter(
        (c) =>
          !term ||
          c.nombre.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          (isDniSearch && c.dni.includes(dniTerm))
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, searchTerm]);

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-[#71717A]">Cargando...</div>;
  }

  if (clientes.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[#71717A]">No hay clientes registrados</div>
    );
  }

  return (
    <Table label="Clientes">
      <TableHeader columns={CLIENTE_COLUMNS} />
      {filtered.map((cliente) => {
        const isSelected = cliente.id === selectedId;
        return (
          <React.Fragment key={cliente.id}>
            <TableRow selected={isSelected} onClick={() => onSelect?.(cliente)}>
              <TableCell width={80} variant="secondary">
                {shortId("CL", cliente.id)}
              </TableCell>
              <TableCell>{cliente.nombre}</TableCell>
              <TableCell width={120} variant="secondary">
                {cliente.dni}
              </TableCell>
              <TableCell width={180} variant="secondary">
                {membresiaLabels[cliente.membresiaAsignada] || cliente.membresiaAsignada}
              </TableCell>
              <TableCell width={140}>
                <TableStatusBadge variant={estadoCuentaVariant(cliente.estadoCuenta)}>
                  {cliente.estadoCuenta}
                </TableStatusBadge>
              </TableCell>
            </TableRow>
            {isSelected && (
              <TableDetailRow>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Email</p>
                  <p className="text-sm text-[#333333]">{cliente.email || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#C13D00]">Teléfono</p>
                  <p className="text-sm text-[#333333]">{cliente.telefono || "-"}</p>
                </div>
              </TableDetailRow>
            )}
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && searchTerm.trim() !== "" && (
        <p className="p-6 text-center text-sm text-[#71717A]">
          {`No se encontraron clientes que coincidan con "${searchTerm}".`}
        </p>
      )}
    </Table>
  );
}
