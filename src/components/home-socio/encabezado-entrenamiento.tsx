"use client";

import React from "react";
import { EncabezadoDeSesion } from "./encabezado-de-sesion";

/**
 * Cabecera de la pantalla de entrenamiento en curso: estado, nombre de la rutina y, debajo, el
 * progreso por series de siempre (`EncabezadoDeSesion`).
 */
export interface EncabezadoEntrenamientoProps {
  rutinaNombre: string | null;
  hechas: number;
  total: number;
  ejercicioNumero: number | null;
  ejerciciosTotal: number;
  transcurridoMs: number;
}

export function EncabezadoEntrenamiento({
  rutinaNombre,
  hechas,
  total,
  ejercicioNumero,
  ejerciciosTotal,
  transcurridoMs,
}: EncabezadoEntrenamientoProps) {
  return (
    <header
      data-testid="encabezado-entrenamiento"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-deep">
        En curso
      </span>
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Entrenamiento de hoy</h2>
        <p className="text-sm text-ink-muted">{rutinaNombre ?? "Rutina asignada"}</p>
      </div>
      <EncabezadoDeSesion
        hechas={hechas}
        total={total}
        ejercicioNumero={ejercicioNumero}
        ejerciciosTotal={ejerciciosTotal}
        transcurridoMs={transcurridoMs}
      />
    </header>
  );
}
