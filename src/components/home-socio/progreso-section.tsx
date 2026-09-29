"use client";

import React from "react";
import { ArrowRight, Target, TrendingUp } from "lucide-react";

/**
 * ProgresoSection — "Mi progreso" for Fila1 of Home_Socio.
 * Matches Home_Socio_1x design: progression of the CURRENT exercise (not a
 * multi-exercise summary), with a PR badge, current mark + monthly delta,
 * and a suggested next-session weight.
 */
export interface PuntoProgreso {
  fecha: string; // ISO date
  carga: number; // kg
}

export interface ProgresoSectionProps {
  ejercicioNombre: string;
  marcaActual: number;
  deltaEsteMes: number;
  /** Sorted oldest-to-newest; the last point is treated as "today". */
  progresionCarga: PuntoProgreso[];
  proximaSesionSugerida: number;
  onVerTodosLosEjercicios?: () => void;
}

const kgFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function formatKg(n: number): string {
  return `${kgFormatter.format(n)} kg`;
}

function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

/** True when `marcaActual` is at or above every previous point in the series
 * (an empty series has nothing to beat, so it counts as a record too). */
export function esPersonalRecord(
  progresionCarga: PuntoProgreso[],
  marcaActual: number
): boolean {
  const anteriores = progresionCarga.slice(0, -1);
  return anteriores.every((p) => marcaActual >= p.carga);
}

export function ProgresoSection({
  ejercicioNombre,
  marcaActual,
  deltaEsteMes,
  progresionCarga,
  proximaSesionSugerida,
  onVerTodosLosEjercicios,
}: ProgresoSectionProps) {
  const sinHistorial = progresionCarga.length === 0;
  const esPR = !sinHistorial && esPersonalRecord(progresionCarga, marcaActual);

  const cargas = progresionCarga.map((p) => p.carga);
  const maxCarga = cargas.length ? Math.max(...cargas) : 0;
  const minCarga = cargas.length ? Math.min(...cargas) : 0;
  const rango = Math.max(maxCarga - minCarga, 1);

  const points = progresionCarga
    .map((p, i) => {
      const x = (i / Math.max(progresionCarga.length - 1, 1)) * 100;
      const y = 100 - ((p.carga - minCarga) / rango) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const incremento = proximaSesionSugerida - marcaActual;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-5">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-bold text-zinc-900">Mi progreso</p>
          <p className="text-sm text-zinc-500">{ejercicioNombre}</p>
        </div>
        <button
          type="button"
          onClick={onVerTodosLosEjercicios}
          className="flex items-center gap-2 text-sm font-medium text-[#FC4C02]"
        >
          Ver todos los ejercicios
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {sinHistorial ? (
        <p className="text-sm text-gray-500">Todavía no registraste entrenamientos.</p>
      ) : (
        <>
          <div className="flex items-center gap-12">
            <div className="flex w-35 flex-col gap-2">
              <p data-testid="marca-actual" className="text-[34px] font-bold text-zinc-900">
                {formatKg(marcaActual)}
              </p>
              <p className="text-[11px] text-zinc-500">Tu marca actual</p>
              <div className="flex items-center gap-2 pt-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <p className="text-xs font-medium text-green-600">
                  {deltaEsteMes >= 0 ? "+" : ""}
                  {kgFormatter.format(deltaEsteMes)} kg este mes
                </p>
              </div>
            </div>

            <div className="flex grow flex-col gap-3">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>{formatKg(maxCarga)}</span>
              </div>
              <div className="relative h-20">
                {esPR && (
                  <span className="absolute right-0 top-0 rounded-sm bg-[#FC4C02] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    PR
                  </span>
                )}
                <svg
                  data-testid="progreso-linea"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                >
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#FC4C02"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>{formatKg(minCarga)}</span>
              </div>
              <div className="flex justify-between px-11 text-[9px] text-zinc-500">
                <span>{formatFechaCorta(progresionCarga[0].fecha)}</span>
                {progresionCarga.length > 2 && (
                  <span>
                    {formatFechaCorta(
                      progresionCarga[Math.floor(progresionCarga.length / 2)].fecha
                    )}
                  </span>
                )}
                <span className="font-bold">Hoy</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-zinc-200 pt-5">
            <Target className="h-[18px] w-[18px] text-[#FC4C02]" />
            <p className="text-sm text-zinc-500">
              Próxima sesión sugerida:{" "}
              <span className="font-bold text-[#FC4C02]">{formatKg(proximaSesionSugerida)}</span>{" "}
              <span className="font-bold text-[#FC4C02]">
                ({incremento >= 0 ? "+" : ""}
                {kgFormatter.format(incremento)} kg)
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
