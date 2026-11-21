"use client";

import React from "react";
import type { EjercicioDeSesionDTO } from "@/api/sesiones";

export interface ListaEjerciciosProps {
  ejercicios: EjercicioDeSesionDTO[];
  /** Id del ejercicio en curso; `null` si no hay una posición válida. */
  actualId: string | null;
}

const ESTADOS = {
  completado: { texto: "Completado", punto: "bg-success", clase: "text-success" },
  actual: { texto: "Actual", punto: "bg-brand", clase: "text-brand-deep" },
  pendiente: { texto: "Pendiente", punto: "bg-ink-disabled", clase: "text-ink-muted" },
} as const;

/**
 * Lista de los ejercicios de la rutina en orden, sin navegación libre: el socio no puede saltar
 * de uno a otro desde acá. El estado se deriva de la posición actual.
 *
 * Limitación conocida: si la sesión arranca en un ejercicio reservado, los anteriores se ven como
 * "Completado" aunque no se hayan hecho en esta sesión; el backend directamente empieza en la
 * reserva y no hay un registro por ejercicio para distinguirlo.
 */
export function ListaEjercicios({ ejercicios, actualId }: ListaEjerciciosProps) {
  const ordenados = [...ejercicios].sort((a, b) => a.orden - b.orden);
  const indiceActual = ordenados.findIndex((ejercicio) => ejercicio.id === actualId);

  return (
    <section
      data-testid="lista-ejercicios"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="text-lg font-bold text-ink">Ejercicios de la rutina</h3>
      <ol className="flex flex-col gap-2">
        {ordenados.map((ejercicio, indice) => {
          const estado =
            indice < indiceActual ? "completado" : indice === indiceActual ? "actual" : "pendiente";
          const estilo = ESTADOS[estado];
          return (
            <li
              key={ejercicio.id}
              data-estado={estado}
              className="flex items-center gap-3 rounded-lg border border-border-soft px-3 py-2"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${estilo.punto}`} aria-hidden="true" />
              <span className={`w-24 shrink-0 text-xs font-bold ${estilo.clase}`}>
                {estilo.texto}
              </span>
              <span className="text-sm text-ink">{ejercicio.nombre}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
