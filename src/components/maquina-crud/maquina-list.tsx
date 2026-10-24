"use client";

import React, { useMemo, useState } from "react";
import type { Maquina, EstadoMaquina, TipoEquipamiento } from "@/domains/maquina/maquina";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  toggleSort,
  compareSortValues,
  normalizeSortText,
  type TableColumn,
  type TableSort,
} from "@/components/ui/table";
import { shortId } from "@/utils/short-id";
import { EstadoBadge } from "./estado-badge";

const MAQUINA_COLUMNS: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "ubicacion", label: "Ubicación", sortable: true },
  { key: "tipoEquipamiento", label: "Tipo", width: 160, sortable: true },
  { key: "estado", label: "Estado", width: 140, sortable: true },
];

const TIPO_LABEL: Record<TipoEquipamiento, string> = {
  MAQUINA_GUIADA: "Máquina guiada",
  PESO_LIBRE: "Peso libre",
  CARDIO: "Cardio",
};

const ESTADO_LABEL: Record<EstadoMaquina, string> = {
  DISPONIBLE: "Disponible",
  OCUPADA: "Ocupada",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  INACTIVA: "Inactiva",
};

export interface MaquinaListProps {
  maquinas: Maquina[];
  selectedId?: string | null;
  onSelect?: (maquina: Maquina) => void;
  isLoading?: boolean;
}

function maquinaSortValue(maquina: Maquina, key: string): string | number {
  switch (key) {
    case "tipoEquipamiento":
      return normalizeSortText(TIPO_LABEL[maquina.tipoEquipamiento]);
    case "estado":
      return normalizeSortText(ESTADO_LABEL[maquina.estado]);
    case "ubicacion":
      return normalizeSortText(maquina.ubicacion);
    case "nombre":
    default:
      return normalizeSortText(maquina.nombre);
  }
}

export function MaquinaList({
  maquinas,
  selectedId = null,
  onSelect,
  isLoading = false,
}: MaquinaListProps) {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoMaquina | "">("");
  const [tipoFilter, setTipoFilter] = useState<TipoEquipamiento | "">("");

  const filtered = useMemo(() => {
    const term = normalizeSortText(searchTerm.trim());
    const rows = maquinas.filter((maquina) => {
      if (estadoFilter && maquina.estado !== estadoFilter) return false;
      if (tipoFilter && maquina.tipoEquipamiento !== tipoFilter) return false;
      if (term && !normalizeSortText(maquina.nombre).includes(term)) return false;
      return true;
    });

    const key = sort?.key ?? "nombre";
    const direction = sort?.direction ?? "asc";

    return rows.sort((a, b) => {
      const cmp = compareSortValues(maquinaSortValue(a, key), maquinaSortValue(b, key));
      return direction === "asc" ? cmp : -cmp;
    });
  }, [maquinas, searchTerm, estadoFilter, tipoFilter, sort]);

  const handleSort = (key: string) => setSort((current) => toggleSort(current, key));

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-ink-muted">Cargando máquinas...</div>;
  }

  if (maquinas.length === 0) {
    return <div className="p-8 text-center text-sm text-ink-muted">No hay máquinas</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <input
          type="text"
          aria-label="Buscar por nombre"
          placeholder="Buscar por nombre"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink-soft placeholder:text-ink-muted"
        />
        <select
          aria-label="Filtrar por estado"
          value={estadoFilter}
          onChange={(event) => setEstadoFilter(event.target.value as EstadoMaquina | "")}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink-soft"
        >
          <option value="">Todos</option>
          <option value="DISPONIBLE">Disponible</option>
          <option value="OCUPADA">Ocupada</option>
          <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
          <option value="INACTIVA">Inactiva</option>
        </select>
        <select
          aria-label="Filtrar por tipo"
          value={tipoFilter}
          onChange={(event) => setTipoFilter(event.target.value as TipoEquipamiento | "")}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink-soft"
        >
          <option value="">Todos</option>
          <option value="MAQUINA_GUIADA">Máquina guiada</option>
          <option value="PESO_LIBRE">Peso libre</option>
          <option value="CARDIO">Cardio</option>
        </select>
      </div>

      <Table label="Máquinas">
        <TableHeader columns={MAQUINA_COLUMNS} sort={sort} onSort={handleSort} disclosure />
        {filtered.map((maquina) => {
          const isSelected = maquina.id === selectedId;
          return (
            <React.Fragment key={maquina.id}>
              <TableRow
                selected={isSelected}
                onClick={() => onSelect?.(maquina)}
                disclosure
              >
                <TableCell width={100} variant="secondary">
                  {shortId("MQ", maquina.id)}
                </TableCell>
                <TableCell>{maquina.nombre}</TableCell>
                <TableCell>{maquina.ubicacion}</TableCell>
                <TableCell width={160}>{TIPO_LABEL[maquina.tipoEquipamiento]}</TableCell>
                <TableCell width={140}>
                  <EstadoBadge estado={maquina.estado} />
                </TableCell>
              </TableRow>
            </React.Fragment>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">
            {searchTerm.trim() !== ""
              ? `No se encontraron máquinas que coincidan con "${searchTerm}".`
              : "No se encontraron máquinas."}
          </p>
        )}
      </Table>
    </div>
  );
}
