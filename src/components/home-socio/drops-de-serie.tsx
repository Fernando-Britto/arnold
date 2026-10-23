"use client";

import React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cargaSugeridaDeDrop, PASO_DE_CARGA_KG } from "@/domains/sesion/drop-set";
import { MAX_DROPS } from "@/domains/sesion/tipo-serie";

/**
 * Drop sets de la serie que se está por registrar (P-46, D-69). Se agregan filas con menos carga
 * y se mandan JUNTO con la serie: no son series de la rutina, no mueven la sesión y no tienen su
 * propio descanso. Como en openGym, cuelgan de la serie ("misma tarjeta").
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */
export interface DropEnEdicion {
  carga: number;
  repeticiones: number;
}

export interface DropsDeSerieProps {
  drops: DropEnEdicion[];
  onChange: (drops: DropEnEdicion[]) => void;
  /** Carga de la serie de la que cuelgan: de ahí parte el primer drop. */
  cargaBase: number;
  /** Repeticiones de la serie: con ese número se precarga cada drop nuevo. */
  repeticionesBase: number;
  deshabilitado?: boolean;
}

const BOTON_REDONDO =
  "flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-ink-soft disabled:text-ink-disabled";

export function DropsDeSerie({
  drops,
  onChange,
  cargaBase,
  repeticionesBase,
  deshabilitado = false,
}: DropsDeSerieProps) {
  const llegoAlMaximo = drops.length >= MAX_DROPS;

  const agregar = () => {
    const anterior = drops[drops.length - 1];
    onChange([
      ...drops,
      {
        carga: cargaSugeridaDeDrop(anterior ? anterior.carga : cargaBase),
        repeticiones: anterior ? anterior.repeticiones : Math.max(1, repeticionesBase),
      },
    ]);
  };

  const cambiar = (indice: number, cambios: Partial<DropEnEdicion>) =>
    onChange(drops.map((d, i) => (i === indice ? { ...d, ...cambios } : d)));

  return (
    <div data-testid="drops-de-serie" className="flex flex-col gap-2">
      {drops.map((drop, i) => {
        const n = i + 1;
        return (
          <div
            key={i}
            role="group"
            aria-label={`Drop ${n}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-border p-2"
          >
            <span className="text-xs font-bold text-ink-muted">DROP {n}</span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deshabilitado}
                aria-label={`Restar peso del drop ${n}`}
                onClick={() => cambiar(i, { carga: Math.max(0, drop.carga - PASO_DE_CARGA_KG) })}
                className={BOTON_REDONDO}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span data-testid={`valor-carga-drop-${n}`} className="min-w-[3ch] text-center font-bold">
                {drop.carga}
              </span>
              <span className="text-xs text-ink-muted">kg</span>
              <button
                type="button"
                disabled={deshabilitado}
                aria-label={`Sumar peso del drop ${n}`}
                onClick={() => cambiar(i, { carga: drop.carga + PASO_DE_CARGA_KG })}
                className={BOTON_REDONDO}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deshabilitado}
                aria-label={`Restar repeticiones del drop ${n}`}
                onClick={() => cambiar(i, { repeticiones: Math.max(1, drop.repeticiones - 1) })}
                className={BOTON_REDONDO}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span data-testid={`valor-repeticiones-drop-${n}`} className="min-w-[2ch] text-center font-bold">
                {drop.repeticiones}
              </span>
              <span className="text-xs text-ink-muted">reps</span>
              <button
                type="button"
                disabled={deshabilitado}
                aria-label={`Sumar repeticiones del drop ${n}`}
                onClick={() => cambiar(i, { repeticiones: drop.repeticiones + 1 })}
                className={BOTON_REDONDO}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              disabled={deshabilitado}
              aria-label={`Quitar drop ${n}`}
              onClick={() => onChange(drops.filter((_, j) => j !== i))}
              className="ml-auto rounded-md p-2 text-ink-muted hover:text-danger disabled:text-ink-disabled"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={agregar}
          disabled={deshabilitado || llegoAlMaximo}
          className="flex items-center gap-1.5 text-sm font-semibold text-brand-strong disabled:text-ink-disabled"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Agregar drop set
        </button>
        {llegoAlMaximo && <span className="text-xs text-ink-muted">Hasta {MAX_DROPS} drop sets por serie.</span>}
      </div>
    </div>
  );
}
