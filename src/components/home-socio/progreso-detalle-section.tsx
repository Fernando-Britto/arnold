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
}

const kgFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function ProgresoDetalleSection({ progreso }: ProgresoDetalleSectionProps) {
  return (
    <section aria-labelledby="progreso-titulo" className="flex flex-col gap-6">
      <h1 id="progreso-titulo" className="text-xl font-bold text-zinc-900">
        Mi progreso
      </h1>

      {progreso.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no registraste entrenamientos.</p>
      ) : (
        progreso.map((p) => {
          const max = Math.max(...p.serie.map((s) => s.carga), 1);
          return (
            <div
              key={p.ejercicioId}
              data-testid="progreso-ejercicio"
              className="flex flex-col gap-4 rounded-lg border border-[#E4E4E7] bg-white p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-zinc-900">{p.ejercicioNombre}</h2>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
                  <span data-testid="progreso-delta" className="text-xs font-medium text-green-600">
                    {p.delta >= 0 ? "+" : ""}
                    {kgFormatter.format(p.delta)} kg
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-2" style={{ height: 120 }} role="img" aria-label={`Progresión de ${p.ejercicioNombre}`}>
                {p.serie.map((punto) => (
                  <div key={punto.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[9px] text-zinc-500">{kgFormatter.format(punto.carga)}</span>
                    <div
                      data-testid="progreso-barra"
                      className="w-full rounded-t bg-[#FC4C02]"
                      style={{ height: `${Math.max(4, (punto.carga / max) * 100)}%` }}
                    />
                    <span className="text-[9px] text-zinc-400">{formatFechaCorta(punto.fecha)}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm text-zinc-500">
                Mejor marca:{" "}
                <span className="font-bold text-zinc-900">{kgFormatter.format(p.mejorMarca)} kg</span>
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}
