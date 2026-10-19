"use client";

import React from "react";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import type { SugerenciaDTO } from "@/api/sesiones";
import { numeroLegible } from "@/domains/sesion/historial-ejercicio";

/** Cómo se dibuja cada tipo de sugerencia. "primera" no tiene línea: ya dice "Primera vez". */
const ESTILO_SUGERENCIA = {
  subir: { clase: "text-green-700", Icono: ArrowUp },
  mantener: { clase: "text-gray-600", Icono: Equal },
  descargar: { clase: "text-amber-700", Icono: ArrowDown },
} as const;

export interface SugerenciaProgresionProps {
  sugerencia: SugerenciaDTO;
  /** Cómo se presenta la carga: "Probá" antes de la serie, "Próxima vez:" en el resumen. */
  prefijo?: string;
}

/**
 * Carga sugerida y el porqué (D-59). El tipo se distingue por ícono y texto además del color,
 * así no depende solo de él. No dibuja nada para "primera": ahí no hay un número honesto.
 */
export function SugerenciaProgresion({ sugerencia, prefijo = "Probá" }: SugerenciaProgresionProps) {
  if (sugerencia.tipo === "primera") return null;
  const estilo = ESTILO_SUGERENCIA[sugerencia.tipo];

  return (
    <p
      data-testid="sugerencia-progresion"
      data-tipo={sugerencia.tipo}
      className={`flex items-start gap-1.5 text-xs font-semibold ${estilo.clase}`}
    >
      <estilo.Icono className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {sugerencia.carga !== null && (
          <strong>
            {prefijo} {numeroLegible(sugerencia.carga)} kg ·{" "}
          </strong>
        )}
        {sugerencia.motivo}
      </span>
    </p>
  );
}
