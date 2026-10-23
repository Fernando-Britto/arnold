"use client";

import React from "react";
import type { UltimaSesionDTO } from "@/api/home-socio";

/**
 * Historial de las últimas sesiones cerradas. Volumen y duración se calculan en el servidor
 * (`buildHomeSocioPayload`) a partir de los registros de progreso y `horaFin − horaInicio`;
 * acá solo se formatean. Si el socio todavía no cerró ninguna sesión, se dice.
 */
export interface UltimasSesionesProps {
  sesiones: UltimaSesionDTO[];
  /** Total de asistencias en las últimas 4 semanas; `null` si no hay membresía. */
  asistencias28: number | null;
}

const fmtDia = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

function fmtNumero(valor: number): string {
  return valor.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function UltimasSesiones({ sesiones, asistencias28 }: UltimasSesionesProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" data-testid="ultimas-sesiones">
      <div className="px-4 pb-0 pt-4">
        <h3 className="text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">
          Últimas sesiones
        </h3>
        {asistencias28 !== null && (
          <p className="mt-1 text-xs font-medium text-ink-muted">
            {asistencias28} asistencias en las últimas 4 semanas
          </p>
        )}
      </div>

      {sesiones.length === 0 ? (
        <p className="px-4 pb-4 pt-3 text-sm text-ink-muted">
          Todavía no cerraste ninguna sesión. La primera va a aparecer acá.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              {["Día", "Rutina", "Series", "Volumen", "Duración"].map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={`border-y border-border px-4 py-2 text-xs font-bold text-ink-disabled ${
                    i > 1 ? "text-right" : "text-left"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sesiones.map((sesion) => (
              <tr key={sesion.id}>
                <td className="border-b border-border-soft px-4 py-2.5 text-xs tabular-nums text-ink-muted">
                  {fmtDia.format(new Date(sesion.fecha))}
                </td>
                <td className="border-b border-border-soft px-4 py-2.5 text-sm font-semibold text-ink">
                  {sesion.rutinaNombre}
                </td>
                <td className="border-b border-border-soft px-4 py-2.5 text-right text-sm tabular-nums text-ink-soft">
                  {sesion.series}
                </td>
                <td className="border-b border-border-soft px-4 py-2.5 text-right text-sm tabular-nums text-ink-soft">
                  {fmtNumero(sesion.volumenKg)} kg
                </td>
                <td className="border-b border-border-soft px-4 py-2.5 text-right text-sm tabular-nums text-ink-soft">
                  {sesion.duracionMin} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
