"use client";

import React from "react";
import type { RachaDTO } from "@/api/home-socio";

/**
 * "Tu serie": la racha como ritmo semanal, no como número suelto.
 *
 * Un contador de semanas dice cuánto, no cuándo. La tira de la semana actual muestra qué días
 * entrenaste y cuál es hoy; la trama de cinco semanas (la actual + las 4 de `dias28`) muestra la
 * forma de la constancia. Las dos cosas son dato existente, no se inventa ninguna.
 */
export interface TuSerieCardProps {
  semanasRacha: number;
  dias: RachaDTO["dias"];
  /** 28 días, del más viejo al más nuevo (4 semanas). Vacío si no hay membresía. */
  dias28: boolean[];
}

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];

export function TuSerieCard({ semanasRacha, dias, dias28 }: TuSerieCardProps) {
  const semanasPrevias = dias28.length === 28 ? [0, 1, 2, 3].map((s) => dias28.slice(s * 7, s * 7 + 7)) : [];

  return (
    <section className="rounded-xl border border-border bg-surface p-4" data-testid="tu-serie">
      <h3 className="text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">Tu serie</h3>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="w-[52px] shrink-0 text-center">
          <Flame />
          <p className="text-xl font-black leading-none tabular-nums text-ink" data-testid="racha-count">
            {semanasRacha}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink-disabled">semanas</p>
        </div>

        <ol className="grid flex-1 grid-cols-7 gap-1">
          {dias.map((dia, i) => (
            <li key={dia.numero} className="text-center">
              <span className="mb-1.5 block text-xs font-bold text-ink-disabled">{LETRAS[i]}</span>
              <span
                data-testid="dia-celda"
                data-estado={dia.esHoy ? "hoy" : dia.asistio ? "asistio" : "libre"}
                className={`grid h-[27px] place-items-center rounded-full text-xs font-bold tabular-nums ${
                  dia.asistio
                    ? "bg-brand text-[#0A0A0B]"
                    : dia.esHoy
                      ? "border-2 border-brand text-ink"
                      : "border border-border text-ink-muted"
                } ${
                  dia.esHoy && dia.asistio
                    ? "ring-2 ring-brand ring-offset-2 ring-offset-surface"
                    : ""
                }`}
              >
                {dia.numero}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {semanasPrevias.length > 0 && (
        <div className="mt-3.5 border-t border-border-soft pt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-disabled">Últimas 5 semanas</p>
          <div className="flex flex-col gap-1.5" aria-hidden="true">
            {semanasPrevias.map((semana, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {semana.map((asistio, j) => (
                  <span
                    key={j}
                    className={`h-2 rounded-[1px] ${asistio ? "bg-brand/45" : "bg-surface-active"}`}
                  />
                ))}
              </div>
            ))}
            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia) => (
                <span
                  key={dia.numero}
                  className={`h-2 rounded-[1px] ${dia.asistio ? "bg-brand" : "bg-surface-active"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Flame() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto text-brand"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
