import React from "react";
import { ChevronDown } from "lucide-react";

export type TableAlign = "left" | "center" | "right";
export type TableCellVariant = "primary" | "secondary";
export type TableStatusVariant = "success" | "warning" | "danger" | "neutral";
export type SortDirection = "asc" | "desc";

export interface TableColumn {
  key: string;
  label: string;
  /**
   * Medida de la columna en px según el mockup. Sirve como base del reparto: todas
   * las columnas crecen y se encogen en proporción a ella (ver `cellStyle`). Omitirla
   * marca la columna principal (Nombre), que arranca más ancha.
   */
  width?: number;
  align?: TableAlign;
  /** Opt-in: renders a clickable header. Requires `TableHeader` `onSort`. */
  sortable?: boolean;
}

/** Active sort state owned by the list that renders the table. */
export interface TableSort {
  key: string;
  direction: SortDirection;
}

function alignClass(align: TableAlign = "left"): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

/**
 * Toggle helper for column headers: a repeated click on the same column flips
 * the direction, a click on another column starts fresh in ascending order.
 */
export function toggleSort(current: TableSort | null, key: string): TableSort {
  if (current && current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

const ACCENT_MARKS = /[\u0300-\u036f]/g;

/**
 * Normalize text for a case- and accent-insensitive sort: "Ábaco" and "abaco"
 * compare equal, so column order does not depend on casing or diacritics.
 */
export function normalizeSortText(value: string): string {
  return value.normalize("NFD").replace(ACCENT_MARKS, "").toLowerCase();
}

/** Comparator shared by list columns: numeric when both are numbers, text otherwise. */
export function compareSortValues(
  a: string | number,
  b: string | number,
): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const textA = String(a);
  const textB = String(b);
  if (textA < textB) return -1;
  if (textA > textB) return 1;
  return 0;
}

/**
 * Medida de arranque de la columna principal (la que no declara `width`).
 */
export const FLEX_BASE = 320;

/**
 * Reparte el ancho del panel entre TODAS las columnas en proporción a su medida:
 * `flex-grow` = base, `flex-basis` = base. Antes las columnas medían px fijo
 * (`flexShrink: 0`) y sólo la principal crecía, así que todo el sobrante de la
 * pantalla caía ahí y en un monitor ancho quedaba un hueco enorme a la derecha
 * del nombre. Ahora la tabla escala manteniendo las proporciones del mockup.
 */
function cellStyle(width?: number): React.CSSProperties {
  const base = width ?? FLEX_BASE;
  return { flexGrow: base, flexShrink: 1, flexBasis: base, minWidth: 0 };
}

/**
 * Ancho de la zona del chevron de despliegue, igual que en el mockup (el ícono vive
 * entre x=1356 y el borde derecho del panel, unos 40px). Es fija y no entra en el
 * reparto proporcional, así la cabecera y las filas siguen alineadas.
 */
export const DISCLOSURE_WIDTH = 40;

/** Table wrapper. Uses ARIA table semantics over flex rows (matches the OpenPencil mockup). */
export function Table({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div role="table" aria-label={label} className="flex flex-col">
      {children}
    </div>
  );
}

/**
 * Header: flex row, h52, px24, gap16, bg surface-subtle, border border, top corners 8.
 * Labels: 13/700 ink-muted.
 *
 * Sorting is opt-in per column (`TableColumn.sortable`) and only activates when
 * `onSort` is provided, so existing non-sortable usages render unchanged.
 *
 * `disclosure` reserva la última zona para el chevron que anuncia que la fila se
 * despliega (el mockup la dibuja vacía en la cabecera y ocupada en cada fila).
 */
export function TableHeader({
  columns,
  sort = null,
  onSort,
  disclosure = false,
}: {
  columns: TableColumn[];
  sort?: TableSort | null;
  onSort?: (key: string) => void;
  disclosure?: boolean;
}) {
  return (
    <div
      role="row"
      className="flex h-[52px] items-center gap-4 rounded-t-lg border-b border-border bg-surface-subtle px-6"
    >
      {columns.map((col) => {
        const isSortable = Boolean(col.sortable && onSort);
        const isActive = isSortable && sort?.key === col.key;
        const ariaSort: React.AriaAttributes["aria-sort"] = isSortable
          ? isActive
            ? sort!.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
          : undefined;
        const indicator = isActive ? (sort!.direction === "asc" ? "▲" : "▼") : "↕";

        return (
          <div
            key={col.key}
            role="columnheader"
            aria-sort={ariaSort}
            className={`text-meta font-bold text-ink-soft ${alignClass(col.align)}`}
            style={cellStyle(col.width)}
          >
            {isSortable ? (
              <button
                type="button"
                onClick={() => onSort!(col.key)}
                title={`Ordenar por ${col.label}`}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-ink-soft"
              >
                <span>{col.label}</span>
                <span aria-hidden="true" data-sort-indicator>
                  {indicator}
                </span>
              </button>
            ) : (
              col.label
            )}
          </div>
        );
      })}
      {disclosure && (
        <div aria-hidden="true" className="shrink-0" style={{ width: DISCLOSURE_WIDTH }} />
      )}
    </div>
  );
}

interface TableRowProps {
  selected?: boolean;
  onClick?: () => void;
  /** Reserva la última zona y dibuja el chevron que anuncia que la fila se despliega. */
  disclosure?: boolean;
  children: React.ReactNode;
}

/**
 * Row: h56, border-bottom border, px24, items-center.
 *
 * Fila desplegada: el mockup la pinta a plena saturación (`#FC4C02` con texto blanco),
 * pero eso daba un golpe de color muy fuerte por fila. Ahora usa la light-brand
 * `#FDEDE4` — la misma superficie que ya tenía la fila de detalle —, así el bloque
 * abierto (fila + detalle) se lee como una unidad suave. Lo que sigue avisando que
 * está abierta es el chevron en naranja apuntando hacia arriba más el detalle debajo.
 *
 * `disclosure` agrega al final el chevron: gris hacia abajo cuando está cerrada,
 * naranja hacia arriba cuando está abierta (igual que los mockups).
 */
export function TableRow({
  selected = false,
  onClick,
  disclosure = false,
  children,
}: TableRowProps) {
  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={onClick}
      className={`flex h-14 items-center gap-4 border-b border-border px-6 ${
        onClick ? "cursor-pointer" : ""
      } ${selected ? "bg-brand-soft" : "bg-surface hover:bg-surface-hover"}`}
    >
      {children}
      {disclosure && (
        <span
          className="flex shrink-0 items-center justify-center"
          style={{ width: DISCLOSURE_WIDTH }}
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            data-disclosure-indicator
            className={`transition-transform duration-150 ${
              selected ? "rotate-180 text-brand" : "text-ink-disabled"
            }`}
          />
        </span>
      )}
    </div>
  );
}

interface TableCellProps {
  width?: number;
  align?: TableAlign;
  variant?: TableCellVariant;
  children: React.ReactNode;
}

/** Cell: 14/400. primary ink-soft, secondary ink-muted. */
export function TableCell({
  width,
  align = "left",
  variant = "primary",
  children,
}: TableCellProps) {
  return (
    <div
      role="cell"
      className={`truncate text-sm ${
        variant === "primary" ? "text-ink-soft" : "text-ink-muted"
      } ${alignClass(align)}`}
      style={cellStyle(width)}
    >
      {children}
    </div>
  );
}

const STATUS_CLASSES: Record<TableStatusVariant, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-subtle text-ink-soft",
};

/** Status badge: h23, bg success-soft, radius, padding 4/10. */
export function TableStatusBadge({
  children,
  variant = "success",
}: {
  children: React.ReactNode;
  variant?: TableStatusVariant;
}) {
  return (
    <span
      className={`inline-flex h-[23px] items-center rounded px-2.5 text-meta font-medium ${STATUS_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}

/**
 * Detail row shown under the selected row (Row_Detail): padding 0/48/24/48, gap 16,
 * light-brand surface.
 */
export function TableDetailRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="row"
      className="flex flex-col gap-4 border-b border-border bg-brand-soft px-12 pb-6 pt-0"
    >
      {children}
    </div>
  );
}
