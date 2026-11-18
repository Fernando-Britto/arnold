"use client";

import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import {
  fetchSociosPorNombre,
  type SocioResumen,
} from "@/api/socios";
import type { EstadoCuotaSocio } from "@/domains/pago/cuota";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
  TableStatusBadge,
  type TableColumn,
  type TableStatusVariant,
} from "@/components/ui/table";
import { handleApiError } from "@/utils/api-error";
import { formatDNI, formatFechaCorta } from "@/utils/formatting";

const LIMITE = 10;
const DEBOUNCE_MS = 300;

const COLUMNAS: TableColumn[] = [
  { key: "cliente", label: "Cliente" },
  { key: "dni", label: "DNI", width: 120 },
  { key: "membresia", label: "Membresía", width: 180 },
  { key: "vencimiento", label: "Vencimiento", width: 140 },
  { key: "estado", label: "Estado", width: 140 },
];

const ESTADO_META: Record<EstadoCuotaSocio, { label: string; variant: TableStatusVariant }> = {
  AL_DIA: { label: "Al día", variant: "success" },
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  VENCIDA: { label: "Vencida", variant: "danger" },
  SIN_CUOTA: { label: "Sin cuota", variant: "neutral" },
};

export interface ClienteBusquedaProps {
  seleccionadoId: string | null;
  onSeleccionar: (socio: SocioResumen) => void;
  /** Cambia para recargar la página actual de resultados (p. ej. tras cobrar). */
  refrescarToken?: number;
}

/**
 * Buscador de clientes por nombre para "Registrar Pago": input con debounce, grilla paginada
 * del lado del servidor y fila seleccionable con ratón o teclado.
 */
export function ClienteBusqueda({
  seleccionadoId,
  onSeleccionar,
  refrescarToken,
}: ClienteBusquedaProps) {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [items, setItems] = useState<SocioResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  // Debounce: una sola consulta ~300 ms después de la última tecla. Cambiar la consulta
  // vuelve a la primera página.
  useEffect(() => {
    const timer = setTimeout(() => {
      setConsulta(texto.trim());
      setPagina(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [texto]);

  // La bandera `cancelado` evita que una respuesta vieja pise a una nueva cuando se encadenan
  // búsquedas o páginas.
  useEffect(() => {
    if (!consulta) return;

    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la bandera de carga debe estar activa antes de que resuelva la promesa; derivarla exigiría duplicar el estado de la consulta.
    setCargando(true);
    setError(null);

    fetchSociosPorNombre({ q: consulta, limit: LIMITE, offset: pagina * LIMITE })
      .then((data) => {
        if (cancelado) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelado) return;
        setItems([]);
        setTotal(0);
        setError(handleApiError(err, "No se pudieron cargar los clientes."));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [consulta, pagina, refrescarToken, reintento]);

  const limpiar = () => {
    setTexto("");
    setConsulta("");
    setPagina(0);
  };

  const desde = total === 0 ? 0 : pagina * LIMITE + 1;
  const hasta = Math.min((pagina + 1) * LIMITE, total);
  const hayResultados = items.length > 0;

  return (
    <section
      aria-label="Búsqueda de clientes"
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">
          {consulta && total > 0 ? `Clientes encontrados (${total})` : "Clientes encontrados"}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Seleccione un cliente para registrar su pago.
        </p>
      </div>

      <div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <Search size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
        <input
          type="search"
          autoComplete="off"
          aria-label="Buscar cliente por nombre o apellido"
          placeholder="Buscar por nombre o apellido..."
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          className="h-full w-full bg-transparent text-sm text-ink-soft outline-none placeholder:text-ink-muted"
        />
        {texto && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={limpiar}
            className="shrink-0 rounded p-1 text-ink-muted hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {!consulta ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Ingrese un nombre o apellido para buscar un cliente.
        </p>
      ) : cargando ? (
        <p role="status" className="py-6 text-center text-sm text-ink-muted">
          Buscando clientes…
        </p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-danger">No se pudieron cargar los clientes.</p>
          <button
            type="button"
            onClick={() => setReintento((n) => n + 1)}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-hover"
          >
            Reintentar
          </button>
        </div>
      ) : !hayResultados ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-ink">No encontramos clientes con ese nombre.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Verificá la escritura o intentá con otro nombre.
          </p>
        </div>
      ) : (
        <Table label="Clientes encontrados">
          <TableHeader columns={COLUMNAS} />
          {items.map((socio) => {
            const estado = socio.membresia
              ? ESTADO_META[socio.estadoCuota]
              : { label: "Sin membresía", variant: "neutral" as const };
            return (
              <TableRow
                key={socio.id}
                selected={socio.id === seleccionadoId}
                onClick={() => onSeleccionar(socio)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    if (event.key === " ") event.preventDefault();
                    onSeleccionar(socio);
                  }
                }}
              >
                <TableCell>{socio.nombre}</TableCell>
                <TableCell width={120}>{formatDNI(socio.dni)}</TableCell>
                <TableCell width={180}>{socio.membresia ?? "Sin membresía"}</TableCell>
                <TableCell width={140}>
                  {socio.fechaVencimiento ? formatFechaCorta(socio.fechaVencimiento) : "—"}
                </TableCell>
                <TableCell width={140}>
                  <TableStatusBadge variant={estado.variant}>{estado.label}</TableStatusBadge>
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      )}

      {!cargando && !error && hayResultados && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-ink-muted">
            Mostrando {desde}–{hasta} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Página anterior"
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled"
            >
              Anterior
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              onClick={() => setPagina((p) => p + 1)}
              disabled={(pagina + 1) * LIMITE >= total}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
