import React from "react";

export type TableAlign = "left" | "center" | "right";
export type TableCellVariant = "primary" | "secondary";
export type TableStatusVariant = "success" | "warning" | "danger" | "neutral";
export type SortDirection = "asc" | "desc";

export interface TableColumn {
  key: string;
  label: string;
  /** Fixed width in px. Omitted => the column grows to fill the row. */
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

function cellStyle(width?: number): React.CSSProperties {
  return width ? { width, flexShrink: 0 } : { flex: 1, minWidth: 0 };
}

/** Table wrapper. Uses ARIA table semantics over flex rows (matches the OpenPencil mockup). */
export function Table({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div role="table" aria-label={label} className="flex flex-col">
      {children}
    </div>
  );
}

/**
 * Header: flex row, h52, px24, gap16, bg #F4F4F5, border #E4E4E7, top corners 8.
 * Labels: 13/700 #71717A.
 *
 * Sorting is opt-in per column (`TableColumn.sortable`) and only activates when
 * `onSort` is provided, so existing non-sortable usages render unchanged.
 */
export function TableHeader({
  columns,
  sort = null,
  onSort,
}: {
  columns: TableColumn[];
  sort?: TableSort | null;
  onSort?: (key: string) => void;
}) {
  return (
    <div
      role="row"
      className="flex h-[52px] items-center gap-4 rounded-t-lg border-b border-[#E4E4E7] bg-[#F4F4F5] px-6"
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
            className={`text-[13px] font-bold text-[#71717A] ${alignClass(col.align)}`}
            style={cellStyle(col.width)}
          >
            {isSortable ? (
              <button
                type="button"
                onClick={() => onSort!(col.key)}
                title={`Ordenar por ${col.label}`}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-[#333333]"
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
    </div>
  );
}

interface TableRowProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Row: h56, border-bottom #E4E4E7, px24, items-center. Selected: bg #FC4C02, white text.
 */
export function TableRow({ selected = false, onClick, children }: TableRowProps) {
  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={onClick}
      className={`flex h-14 items-center gap-4 border-b border-[#E4E4E7] px-6 ${
        onClick ? "cursor-pointer" : ""
      } ${
        selected
          ? "bg-[#FC4C02] text-white [&>*]:text-white"
          : "bg-white hover:bg-[#FAFAFA]"
      }`}
    >
      {children}
    </div>
  );
}

interface TableCellProps {
  width?: number;
  align?: TableAlign;
  variant?: TableCellVariant;
  children: React.ReactNode;
}

/** Cell: 14/400. primary #333333, secondary #71717A. */
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
        variant === "primary" ? "text-[#333333]" : "text-[#71717A]"
      } ${alignClass(align)}`}
      style={cellStyle(width)}
    >
      {children}
    </div>
  );
}

const STATUS_CLASSES: Record<TableStatusVariant, string> = {
  success: "bg-[#DEF7EC] text-[#14B452]",
  warning: "bg-[#FEF3C7] text-[#B94A0E]",
  danger: "bg-[#FEE2E2] text-[#DC2626]",
  neutral: "bg-[#F4F4F5] text-[#71717A]",
};

/** Status badge: h23, bg #DEF7EC, radius, padding 4/10. */
export function TableStatusBadge({
  children,
  variant = "success",
}: {
  children: React.ReactNode;
  variant?: TableStatusVariant;
}) {
  return (
    <span
      className={`inline-flex h-[23px] items-center rounded px-2.5 text-[13px] font-medium ${STATUS_CLASSES[variant]}`}
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
      className="flex flex-col gap-4 border-b border-[#E4E4E7] bg-[#FDEDE4] px-12 pb-6 pt-0"
    >
      {children}
    </div>
  );
}
