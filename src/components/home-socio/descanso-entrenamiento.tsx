"use client";

import React from "react";
import { TimerReset } from "lucide-react";
import { formatearDescanso } from "@/domains/home-socio/descanso";

/** La próxima serie que se registra cuando termine el descanso. */
export interface SiguienteSerie {
  ejercicioNombre: string;
  numeroSerie: number;
  totalSeries: number;
  repeticiones: number;
  cargaSugerida: number;
}

export interface DescansoEntrenamientoProps {
  restanteSegundos: number;
  expirado: boolean;
  pausado: boolean;
  siguiente: SiguienteSerie | null;
  onMas15: () => void;
  onMenos15: () => void;
  onPausar: () => void;
  onReanudar: () => void;
  onContinuar: () => void;
}

/**
 * Descanso entre series como estado independiente: un cronómetro grande, ajustes de ±15 s,
 * pausa/reanudar y el resumen de la serie que sigue. No avanza solo: el socio continúa a mano.
 * El aviso de fin es visual, sin sonido.
 */
export function DescansoEntrenamiento({
  restanteSegundos,
  expirado,
  pausado,
  siguiente,
  onMas15,
  onMenos15,
  onPausar,
  onReanudar,
  onContinuar,
}: DescansoEntrenamientoProps) {
  return (
    <section
      data-testid="descanso-entrenamiento"
      className="flex w-full flex-col items-center gap-6 rounded-lg border border-border bg-surface p-8 text-center"
    >
      <div className="flex items-center gap-2 text-warning">
        <TimerReset className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-bold tracking-wide">DESCANSO</span>
      </div>

      <p
        data-testid="descanso-tiempo"
        role="timer"
        aria-live="off"
        className="text-7xl font-black tabular-nums text-ink"
      >
        {formatearDescanso(restanteSegundos)}
      </p>

      {expirado && (
        <p data-testid="descanso-terminado" role="status" className="text-lg font-bold text-success">
          ¡Descanso terminado!
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onMenos15}
          disabled={expirado}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-ink-soft disabled:text-ink-disabled"
        >
          −15 s
        </button>
        <button
          type="button"
          onClick={onMas15}
          disabled={expirado}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-ink-soft disabled:text-ink-disabled"
        >
          +15 s
        </button>
        <button
          type="button"
          onClick={pausado ? onReanudar : onPausar}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-ink-soft"
        >
          {pausado ? "Reanudar" : "Pausar"}
        </button>
        <button
          type="button"
          onClick={onContinuar}
          className="rounded-lg px-3 py-2 text-sm font-bold text-brand-strong underline"
        >
          Saltar descanso
        </button>
      </div>

      {siguiente && (
        <div
          data-testid="siguiente-serie"
          className="flex w-full max-w-sm flex-col gap-1 rounded-lg border border-border bg-surface-subtle p-4 text-left"
        >
          <p className="text-xs font-bold text-ink-muted">SIGUIENTE SERIE</p>
          <p className="font-bold text-ink">{siguiente.ejercicioNombre}</p>
          <p className="text-sm text-ink-muted">
            Serie {siguiente.numeroSerie} de {siguiente.totalSeries}
          </p>
          <p className="text-sm text-ink-muted">{siguiente.repeticiones} repeticiones</p>
          <p className="text-sm font-semibold text-ink">
            Carga sugerida: {siguiente.cargaSugerida} kg
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onContinuar}
        className={`flex h-12 w-full max-w-sm items-center justify-center rounded-lg bg-brand-strong text-[15px] font-bold text-surface ${
          expirado ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""
        }`}
      >
        Continuar entrenamiento
      </button>
    </section>
  );
}
