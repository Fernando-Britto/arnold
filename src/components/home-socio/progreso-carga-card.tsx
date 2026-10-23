"use client";

import React from "react";
import type { PuntoProgresoDTO } from "@/api/home-socio";

/**
 * Progreso de carga del ejercicio que el motor de progresión está siguiendo.
 *
 * Antes era un gráfico de línea sin eje ni valores junto a un número grande. Acá cada barra es
 * una sesión con su carga, así la forma del gráfico es el dato: no hay sparkline que adivinar.
 */
export interface ProgresoCargaCardProps {
  ejercicioNombre: string;
  marcaActual: number;
  deltaEsteMes: number;
  progresionCarga: PuntoProgresoDTO[];
}

const fmtDia = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

function formatKg(valor: number): string {
  return valor.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

export function ProgresoCargaCard({
  ejercicioNombre,
  marcaActual,
  deltaEsteMes,
  progresionCarga,
}: ProgresoCargaCardProps) {
  if (!ejercicioNombre) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4" data-testid="progreso-carga">
        <h3 className="text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">
          Progreso de carga
        </h3>
        <p className="mt-3 text-sm text-ink-muted">Todavía no hay registros para graficar.</p>
      </section>
    );
  }

  const puntos = progresionCarga.slice(-6);
  const maximo = Math.max(...puntos.map((p) => p.carga), marcaActual, 1);
  const sube = deltaEsteMes > 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-4" data-testid="progreso-carga">
      <h3 className="truncate text-overline font-bold uppercase tracking-[0.14em] text-ink-disabled">
        {ejercicioNombre} · carga
      </h3>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-black tracking-tight tabular-nums text-ink">
          {formatKg(marcaActual)}
        </span>
        <span className="text-sm font-semibold text-ink-muted">kg</span>
      </p>
      <p
        className={`text-xs font-bold ${deltaEsteMes === 0 ? "text-ink-muted" : sube ? "text-success" : "text-warning"}`}
        data-testid="progreso-delta"
      >
        {deltaEsteMes === 0
          ? "Sin cambios este mes"
          : `${sube ? "+" : "−"}${formatKg(Math.abs(deltaEsteMes))} kg este mes`}
      </p>

      <div className="mt-4 flex h-20 items-end gap-1.5 border-b border-border" aria-hidden="true">
        {puntos.map((punto, i) => (
          <span
            key={`${punto.fecha}-${i}`}
            className={`flex-1 rounded-t-sm ${i === puntos.length - 1 ? "bg-brand" : "bg-surface-active"}`}
            style={{ height: `${Math.max(8, Math.round((punto.carga / maximo) * 100))}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-disabled">
        <span>{puntos.length > 0 ? fmtDia.format(new Date(puntos[0].fecha)) : "—"}</span>
        <span>{puntos.length > 1 ? fmtDia.format(new Date(puntos[puntos.length - 1].fecha)) : ""}</span>
      </div>
    </section>
  );
}
