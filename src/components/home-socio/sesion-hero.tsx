"use client";

import React from "react";
import { Play } from "lucide-react";
import type { EjercicioEnRutinaDTO } from "@/api/home-socio";

/**
 * La sesión de hoy como recorrido, no como tarjeta.
 *
 * Reemplaza a `TarjetaRutina` + `TarjetaDetalle` en el inicio. Antes la rutina era una fila de
 * tarjetas iguales con dos barras de progreso distintas (una por ejercicio y otra global) más el
 * detalle en otra tarjeta. Acá hay un solo eje: cinco paradas numeradas, la actual marcada, y una
 * única acción. La media del ejercicio actual viene del catálogo real (`public/ejercicios`).
 */
export interface SesionHeroProps {
  rutinaNombre: string | null;
  ejercicios: EjercicioEnRutinaDTO[];
  indiceActual: number;
  sesionEnProgreso: boolean;
  onSeguirRutina?: () => void;
}

export function SesionHero({
  rutinaNombre,
  ejercicios,
  indiceActual,
  sesionEnProgreso,
  onSeguirRutina,
}: SesionHeroProps) {
  if (!rutinaNombre || ejercicios.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6" data-testid="card-rutina">
        <h2 className="text-2xl font-black tracking-tight text-ink">Sin rutina asignada</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Cuando un instructor te asigne una rutina, la vas a ver acá.
        </p>
      </section>
    );
  }

  const totalSeries = ejercicios.reduce((total, e) => total + e.series, 0);
  const completados = Math.min(indiceActual, ejercicios.length);
  const actual = ejercicios[Math.min(indiceActual, ejercicios.length - 1)];
  const mediaId = actual?.mediaId ?? null;

  return (
    <section
      className="grid overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[1fr_300px]"
      data-testid="card-rutina"
    >
      <div className="flex flex-col p-5 lg:p-6">
        <h2 className="text-4xl font-black leading-none tracking-tight text-ink">{rutinaNombre}</h2>
        <p className="mt-2.5 text-sm text-ink-muted">
          <span className="font-semibold text-ink-soft">{ejercicios.length} ejercicios</span>
          {" · "}
          <span className="font-semibold text-ink-soft">{totalSeries} series</span>
          {" · "}
          <span className="font-semibold text-ink-soft">
            {completados} de {ejercicios.length} completados
          </span>
        </p>

        <ol className="mt-5 flex flex-col" data-testid="recorrido-sesion">
          {ejercicios.map((ejercicio, i) => {
            const estado = i < indiceActual ? "hecho" : i === indiceActual ? "actual" : "pendiente";
            return (
              <li
                key={ejercicio.id}
                data-estado={estado}
                className={`relative grid h-10 grid-cols-[26px_1fr_auto] items-center gap-2.5 border-t border-border-soft first:border-t-0 ${
                  estado === "actual"
                    ? "bg-gradient-to-r from-brand/10 to-transparent pl-2.5 before:absolute before:-left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-brand before:content-['']"
                    : ""
                }`}
              >
                <span
                  className={`text-xs font-extrabold tabular-nums ${
                    estado === "actual" ? "text-brand" : estado === "hecho" ? "text-ink-soft" : "text-ink-disabled"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`truncate text-sm ${
                    estado === "actual" ? "font-bold text-ink" : estado === "hecho" ? "text-ink-soft" : "text-ink-muted"
                  }`}
                >
                  {ejercicio.nombre}
                </span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    estado === "actual" ? "text-ink" : "text-ink-disabled"
                  }`}
                >
                  {ejercicio.series} × {ejercicio.repeticiones}
                </span>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={onSeguirRutina}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-brand text-sm font-extrabold text-[#0A0A0B]"
        >
          <Play size={16} aria-hidden="true" />
          {sesionEnProgreso ? "Retomar entrenamiento" : "Empezar entrenamiento"}
        </button>
      </div>

      {mediaId && (
        <div className="relative hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/ejercicios/${mediaId}.jpg`}
            alt={actual.nombre}
            className="h-full w-full object-cover opacity-30"
            loading="lazy"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-surface via-surface/50 to-surface/20"
          />
        </div>
      )}
    </section>
  );
}
