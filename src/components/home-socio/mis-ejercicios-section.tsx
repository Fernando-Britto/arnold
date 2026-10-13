"use client";

import React from "react";
import { Trophy } from "lucide-react";
import type { EjercicioDeRutinaDTO } from "@/api/home-socio-secciones";

/**
 * MisEjerciciosSection (T-039, D-45): los ejercicios de la rutina del socio con su
 * descripción y su mejor marca (max `carga` de `RegistroDeProgreso`).
 */
export interface MisEjerciciosSectionProps {
  ejercicios: EjercicioDeRutinaDTO[];
}

const kgFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export function MisEjerciciosSection({ ejercicios }: MisEjerciciosSectionProps) {
  return (
    <section aria-labelledby="mis-ejercicios-titulo" className="flex flex-col gap-6">
      <h1 id="mis-ejercicios-titulo" className="text-xl font-bold text-zinc-900">
        Mis ejercicios
      </h1>

      {ejercicios.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no tenés ejercicios asignados.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {ejercicios.map((e) => (
            <li
              key={e.id}
              data-testid="ejercicio-card"
              className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-900">{e.nombre}</span>
                  <span className="text-xs text-zinc-500">{e.grupoMuscular}</span>
                </div>
                <span className="rounded-sm bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                  {e.series} × {e.repeticiones}
                </span>
              </div>

              <p className="text-sm text-zinc-600">
                {e.descripcion ?? "Sin descripción."}
              </p>

              <div className="flex items-center gap-2 border-t border-zinc-100 pt-3">
                <Trophy className="h-4 w-4 text-[#FC4C02]" aria-hidden="true" />
                <span className="text-xs text-zinc-500">Mejor marca:</span>
                <span data-testid="mejor-marca" className="text-sm font-bold text-zinc-900">
                  {e.mejorMarca !== null ? `${kgFormatter.format(e.mejorMarca)} kg` : "Sin registros"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
