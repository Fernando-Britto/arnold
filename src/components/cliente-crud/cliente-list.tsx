import React, { useMemo, useState } from "react";
import { normalizeDNI, type EstadoCuenta } from "@/domains/cliente/cliente";
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
  type TableStatusVariant,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";

/** Columns exactly as the OpenPencil mockup (relative widths from the spec). */
export const CLIENTE_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 80 },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "dni", label: "DNI", width: 120, sortable: true },
  { key: "membresia", label: "Membresía", width: 180, sortable: true },
  { key: "estadoCuota", label: "Estado de cuota", width: 140, sortable: true },
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
    case "Activa":
      return "success";
    case "Inactiva":
      return "warning";
    case "Bloqueada":
      return "danger";
    default:
      return "neutral";
  }
}

/** Sortable value per column, normalized for a case/accent-insensitive compare. */
function clienteSortValue(
  cliente: ClienteRow,
  key: string,
  membresiaLabels: Record<string, string>,
): string {
  switch (key) {
    case "dni":
      return normalizeSortText(cliente.dni);
    case "membresia":
      return normalizeSortText(
        membresiaLabels[cliente.membresiaAsignada] || cliente.membresiaAsignada,
      );
    case "estadoCuota":
      return normalizeSortText(cliente.estadoCuenta);
    case "nombre":
    default:
      return normalizeSortText(cliente.nombre);
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
  const [sort, setSort] = useState<TableSort | null>(null);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // Los DNI se guardan sin puntos (normalizeDNI). Si el término es un DNI
    // (sólo dígitos y separadores), se compara normalizado para que "30.123.456"
    // encuentre "30123456". Para nombre/email se usa el término tal cual.
    const dniTerm = normalizeDNI(term);
    const isDniSearch = dniTerm.length > 0 && /^[\d.\s-]+$/.test(term);
    const rows = clientes.filter(
      (c) =>
        !term ||
        c.nombre.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (isDniSearch && c.dni.includes(dniTerm))
    );
    // Sin orden explícito se conserva el orden por defecto (nombre asc).
    const key = sort?.key ?? "nombre";
    const direction = sort?.direction ?? "asc";
    return rows.sort((a, b) => {
      const cmp = compareSortValues(
        clienteSortValue(a, key, membresiaLabels),
        clienteSortValue(b, key, membresiaLabels),
      );
      return direction === "asc" ? cmp : -cmp;
    });
  }, [clientes, searchTerm, sort, membresiaLabels]);

  const handleSort = (key: string) => setSort((current) => toggleSort(current, key));

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-ink-muted">Cargando...</div>;
  }

  if (clientes.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-ink-muted">No hay clientes registrados</div>
    );
  }

  return (
    <Table label="Clientes">
      <TableHeader columns={CLIENTE_COLUMNS} sort={sort} onSort={handleSort} disclosure />
      {filtered.map((cliente) => {
        const isSelected = cliente.id === selectedId;
        return (
          <React.Fragment key={cliente.id}>
            <TableRow selected={isSelected} onClick={() => onSelect?.(cliente)} disclosure>
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
                  <p className="text-overline font-bold uppercase text-brand-strong">Email</p>
                  <p className="text-sm text-ink-soft">{cliente.email || "-"}</p>
                </div>
                <div>
                  <p className="text-overline font-bold uppercase text-brand-strong">Teléfono</p>
                  <p className="text-sm text-ink-soft">{cliente.telefono || "-"}</p>
                </div>
              </TableDetailRow>
            )}
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && searchTerm.trim() !== "" && (
        <p className="p-6 text-center text-sm text-ink-muted">
          {`No se encontraron clientes que coincidan con "${searchTerm}".`}
        </p>
      )}
    </Table>
  );
}
