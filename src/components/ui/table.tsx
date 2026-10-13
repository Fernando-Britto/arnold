import React from "react";

export type TableAlign = "left" | "center" | "right";
export type TableCellVariant = "primary" | "secondary";
export type TableStatusVariant = "success" | "warning" | "danger" | "neutral";

export interface TableColumn {
  key: string;
  label: string;
  /** Fixed width in px. Omitted => the column grows to fill the row. */
  width?: number;
  align?: TableAlign;
}

function alignClass(align: TableAlign = "left"): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
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
 */
export function TableHeader({ columns }: { columns: TableColumn[] }) {
  return (
    <div
      role="row"
      className="flex h-[52px] items-center gap-4 rounded-t-lg border-b border-[#E4E4E7] bg-[#F4F4F5] px-6"
    >
      {columns.map((col) => (
        <div
          key={col.key}
          role="columnheader"
          className={`text-[13px] font-bold text-[#71717A] ${alignClass(col.align)}`}
          style={cellStyle(col.width)}
        >
          {col.label}
        </div>
      ))}
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
