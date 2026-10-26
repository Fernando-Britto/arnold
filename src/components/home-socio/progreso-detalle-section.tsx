"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import type { ProgresoEjercicioDTO } from "@/api/home-socio-secciones";

/**
 * ProgresoDetalleSection (T-039, D-45): cargas y mejores marcas en el tiempo, por ejercicio.
 * Gráfico de barras con CSS puro (sin librería de charts): cada barra es un día con la mayor
 * carga de ese día, con la altura relativa al máximo de la serie.
 */
export interface ProgresoDetalleSectionProps {
  progreso: ProgresoEjercicioDTO[];
  /** Contenido que va justo debajo del título, antes de los ejercicios (T-051: el balance muscular). */
  extra?: React.ReactNode;
}

const kgFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function ProgresoDetalleSection({ progreso, extra }: ProgresoDetalleSectionProps) {
  return (
    <section aria-labelledby="progreso-titulo" className="flex flex-col gap-6">
      <h1 id="progreso-titulo" className="text-xl font-bold text-ink">
        Mi progreso
      </h1>

      {extra}

      {progreso.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no registraste entrenamientos.</p>
      ) : (
        progreso.map((p) => {
          const max = Math.max(...p.serie.map((s) => s.carga), 1);
          return (
            <div
              key={p.ejercicioId}
              data-testid="progreso-ejercicio"
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink">{p.ejercicioNombre}</h2>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
                  <span data-testid="progreso-delta" className="text-xs font-medium text-success">
                    {p.delta >= 0 ? "+" : ""}
                    {kgFormatter.format(p.delta)} kg
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-2" style={{ height: 120 }} role="img" aria-label={`Progresión de ${p.ejercicioNombre}`}>
                {p.serie.map((punto) => (
                  <div key={punto.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-overline text-ink-muted">{kgFormatter.format(punto.carga)}</span>
                    <div
                      data-testid="progreso-barra"
                      className="w-full rounded-t bg-brand"
                      style={{ height: `${Math.max(4, (punto.carga / max) * 100)}%` }}
                    />
                    <span className="text-overline text-ink-muted">{formatFechaCorta(punto.fecha)}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm text-ink-muted">
                Mejor marca:{" "}
                <span className="font-bold text-ink">{kgFormatter.format(p.mejorMarca)} kg</span>
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}
