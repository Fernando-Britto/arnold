import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableStatusBadge,
  type TableColumn,
} from "@/components/ui/table";
import type { DispositivoDTO } from "@/api/dispositivos";

const COLUMNS: TableColumn[] = [
  { key: "nombre", label: "Nombre" },
  { key: "tipo", label: "Tipo", width: 120 },
  { key: "estado", label: "Estado", width: 120 },
  { key: "ultimoContacto", label: "Último contacto", width: 200 },
  { key: "acciones", label: "Acciones", width: 140, align: "right" },
];

const TIPO_LABEL: Record<string, string> = { PUERTA: "Puerta", RECEPCION: "Recepción" };
const ESTADO_LABEL: Record<string, string> = { ACTIVO: "Activo", INACTIVO: "Inactivo" };

/** Último contacto legible; "Nunca" si el dispositivo todavía no dio señales. */
function formatearUltimoContacto(fecha: Date | string | null): string {
  if (!fecha) return "Nunca";
  return new Date(fecha).toLocaleString("es-AR");
}

export interface DispositivoListPanelProps {
  dispositivos: DispositivoDTO[];
  onDesactivar: (dispositivo: DispositivoDTO) => void;
  /** Id del dispositivo cuya desactivación está en curso (deshabilita su botón). */
  desactivandoId?: string | null;
}

/** Tabla de dispositivos (AC-11): nombre, tipo, estado, último contacto y acción de desactivar. */
export function DispositivoListPanel({
  dispositivos,
  onDesactivar,
  desactivandoId = null,
}: DispositivoListPanelProps) {
  if (dispositivos.length === 0) {
    return <div className="p-8 text-center text-sm text-[#71717A]">No hay dispositivos</div>;
  }

  return (
    <Table label="Dispositivos">
      <TableHeader columns={COLUMNS} />
      {dispositivos.map((dispositivo) => (
        <TableRow key={dispositivo.id}>
          <TableCell>{dispositivo.nombre}</TableCell>
          <TableCell width={120} variant="secondary">
            {TIPO_LABEL[dispositivo.tipo] ?? dispositivo.tipo}
          </TableCell>
          <TableCell width={120} variant="secondary">
            <TableStatusBadge variant={dispositivo.estado === "ACTIVO" ? "success" : "neutral"}>
              {ESTADO_LABEL[dispositivo.estado] ?? dispositivo.estado}
            </TableStatusBadge>
          </TableCell>
          <TableCell width={200} variant="secondary">
            {formatearUltimoContacto(dispositivo.ultimoContacto)}
          </TableCell>
          <TableCell width={140} align="right">
            {dispositivo.estado === "ACTIVO" ? (
              <button
                type="button"
                onClick={() => onDesactivar(dispositivo)}
                disabled={desactivandoId === dispositivo.id}
                className="rounded border border-[#E5E5E5] bg-white px-3 py-1 text-sm font-medium text-[#333333] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Desactivar
              </button>
            ) : null}
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
