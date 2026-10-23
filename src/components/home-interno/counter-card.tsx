"use client";

import React from "react";
import { SIN_ACCESO_TITLE } from "./sin-acceso";

/**
 * Contador de gestión: etiqueta + número, clickeable al listado del CRUD.
 *
 * Antes era una tarjeta con borde y fondo propio, y había cuatro en fila debajo de
 * otras tres tarjetas de operación: el home interno mostraba trece tarjetas del mismo
 * peso, con los mismos destinos que ya ofrece la nav. Ahora es una métrica en línea;
 * el contenedor que las agrupa vive en la página.
 */
export interface CounterCardProps {
  label: string;
  /** Pre-formatted count, e.g. "124". */
  metric: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function CounterCard({ label, metric, onClick, disabled = false }: CounterCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? SIN_ACCESO_TITLE : undefined}
      className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-meta font-medium text-ink-muted">{label}</span>
      <span className="text-xl font-bold text-ink">{metric}</span>
    </button>
  );
}
