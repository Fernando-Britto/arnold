"use client";

import React from "react";

/**
 * "Pendientes de hoy": excepciones que requieren una decisión hoy, cada una con UNA acción.
 *
 * Reemplaza a la lista pasiva de vencimientos, que no dejaba hacer nada, repetía el total tres
 * veces ("3", "3 socios", "Ver los 3") y pintaba las tres filas del mismo naranja, así que
 * "vence hace 2 días" no se distinguía de "vence en 5 horas".
 *
 * El color sale del nivel, no del diseño: rojo para lo vencido, ámbar para lo que vence hoy,
 * neutro para el resto. El naranja queda para la acción primaria: solo el primer pendiente —el
 * más urgente— la lleva rellena.
 */
export type NivelPendiente = "danger" | "warning" | "neutral";

export interface Pendiente {
  id: string;
  titulo: string;
  detalle: string;
  nivel: NivelPendiente;
  /** Texto de la única acción posible. */
  accion: string;
  onAccion: () => void;
  /** El rol no puede resolverlo: se ve, pero no se puede accionar. */
  disabled?: boolean;
}

const NIVEL_TEXTO: Record<NivelPendiente, string> = {
  danger: "text-danger",
  warning: "text-warning",
  neutral: "text-ink-muted",
};

export interface PendientesDeHoyProps {
  pendientes: Pendiente[];
  /** Sin pendientes: el estado vacío dice que no hay nada que decidir. */
  vacioTexto?: string;
}

export function PendientesDeHoy({
  pendientes,
  vacioTexto = "Nada pendiente. El día está al día.",
}: PendientesDeHoyProps) {
  return (
    <section
      aria-labelledby="pendientes-hoy"
      className="flex h-full flex-col rounded-lg border border-border bg-surface p-5"
      data-testid="pendientes-de-hoy"
    >
      <h2 id="pendientes-hoy" className="text-meta font-bold text-ink">
        Pendientes de hoy
      </h2>

      {pendientes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{vacioTexto}</p>
      ) : (
        <ul className="mt-2 flex flex-1 flex-col justify-start">
          {pendientes.map((pendiente, indice) => (
            <li
              key={pendiente.id}
              className="flex items-center justify-between gap-3 border-b border-border-soft py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${NIVEL_TEXTO[pendiente.nivel]}`}>
                  {pendiente.titulo}
                </p>
                <p className="truncate text-xs text-ink-disabled">{pendiente.detalle}</p>
              </div>
              <button
                type="button"
                onClick={pendiente.onAccion}
                disabled={pendiente.disabled}
                {...(pendiente.disabled ? { title: "Sin acceso con tu rol" } : {})}
                className={`h-8 shrink-0 rounded-md px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                  indice === 0
                    ? "bg-brand text-[#0A0A0B]"
                    : "border border-border text-ink-soft enabled:hover:bg-surface-hover"
                }`}
              >
                {pendiente.accion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
