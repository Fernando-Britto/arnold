"use client";

import React from "react";
import { Flame } from "lucide-react";
import type { AsistenciasSeccionDTO } from "@/api/home-socio-secciones";

/**
 * AsistenciasSection (T-039, D-45): calendario de asistencias y racha. La ventana la arma
 * el dominio (`buildCalendarioAsistencias`, 35 días del gimnasio) y la racha reutiliza la
 * regla de Home_Socio.
 */
export interface AsistenciasSectionProps {
  asistencias: AsistenciasSeccionDTO;
}

const DIAS_LABEL = ["L", "M", "X", "J", "V", "S", "D"];

export function AsistenciasSection({ asistencias }: AsistenciasSectionProps) {
  const { rachaSemanas, total, dias } = asistencias;

  return (
    <section aria-labelledby="asistencias-titulo" className="flex flex-col gap-6">
      <h1 id="asistencias-titulo" className="text-xl font-bold text-ink">
        Mis asistencias
      </h1>

      <div className="flex items-center gap-10 rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Flame className="h-7 w-7 text-brand" aria-hidden="true" />
            <p data-testid="asistencias-racha" className="text-hero font-bold text-ink">
              {rachaSemanas}
            </p>
          </div>
          <p className="text-meta text-ink-muted">{rachaSemanas === 1 ? "Semana" : "Semanas"}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-ink-muted">Últimos 35 días</p>
          <p data-testid="asistencias-total" className="text-4xl font-bold text-brand">
            {total}
          </p>
          <p className="text-xs text-ink-muted">{total === 1 ? "Asistencia" : "Asistencias"}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            {DIAS_LABEL.map((l) => (
              <p key={l} className="w-6 text-center text-overline text-ink-muted">
                {l}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2, 3, 4].map((fila) => (
              <div key={fila} className="flex gap-3">
                {DIAS_LABEL.map((_, col) => {
                  const dia = dias[fila * 7 + col];
                  if (!dia) return <span key={col} className="h-6 w-6" />;
                  return (
                    <span
                      key={col}
                      data-testid="asistencia-celda"
                      data-asistio={dia.asistio ? "true" : "false"}
                      title={dia.fecha}
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-overline ${
                        dia.asistio ? "bg-brand-strong text-surface" : "bg-surface-subtle text-ink-soft"
                      }`}
                    >
                      {Number(dia.fecha.slice(8, 10))}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {total === 0 && (
        <p className="text-sm text-ink-muted">Todavía no registraste asistencias en las últimas 5 semanas.</p>
      )}
    </section>
  );
}
