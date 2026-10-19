"use client";

import React from "react";
import { ArrowDown, ArrowUp, Equal, Star, Trophy } from "lucide-react";
import type { ResumenSesionDTO, TendenciaDTO } from "@/api/sesiones";
import { describirSeries, numeroLegible } from "@/domains/sesion/historial-ejercicio";
import { SugerenciaProgresion } from "./sugerencia-progresion";

/** Cómo se presenta cada tendencia. Se distingue por ícono y texto, no solo por color. */
const ESTILO_TENDENCIA: Record<
  TendenciaDTO,
  { texto: string; clase: string; Icono: typeof ArrowUp }
> = {
  subio: { texto: "Mejor que la última vez", clase: "text-green-700", Icono: ArrowUp },
  bajo: { texto: "Menos que la última vez", clase: "text-amber-700", Icono: ArrowDown },
  igual: { texto: "Igual que la última vez", clase: "text-gray-600", Icono: Equal },
  primera: { texto: "Primera vez", clase: "text-gray-600", Icono: Star },
};

/** Una marca personal batida hoy (T-046c, D-63): trofeo y texto, no solo color. */
function MarcaNueva({ tipo, texto }: { tipo: "carga" | "e1rm"; texto: string }) {
  return (
    <p
      data-testid="resumen-marca"
      data-marca={tipo}
      className="flex items-center gap-1.5 text-xs font-bold text-orange-700"
    >
      <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {texto}
    </p>
  );
}

export interface ResumenDeSesionProps {
  resumen: ResumenSesionDTO;
}

/**
 * Resumen al terminar la sesión (T-046b, D-62): por ejercicio, lo de hoy, cómo le fue contra
 * la última vez y la carga de la próxima sesión, la misma que después se precarga.
 */
export function ResumenDeSesion({ resumen }: ResumenDeSesionProps) {
  const series = `${resumen.seriesHechas} ${resumen.seriesHechas === 1 ? "serie" : "series"}`;
  const totales =
    resumen.duracionMinutos !== null ? `${series} · ${resumen.duracionMinutos} min` : series;

  return (
    <div data-testid="resumen-sesion" className="flex w-full flex-col gap-3 text-left">
      <p data-testid="resumen-totales" className="text-center text-sm text-gray-500">
        {totales}
      </p>
      <ul className="flex flex-col gap-3">
        {resumen.ejercicios.map((ejercicio) => {
          const tendencia = ESTILO_TENDENCIA[ejercicio.tendencia];
          // Un servidor anterior a D-63 no manda `marcas`: sin ellas se muestra todo lo demás.
          const marcas = ejercicio.marcas ?? { carga: null, e1rm: null };
          return (
            <li
              key={ejercicio.ejercicioId}
              data-testid="resumen-ejercicio"
              className="flex flex-col gap-1.5 rounded-lg border border-[#E4E4E7] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-gray-900">{ejercicio.nombre}</p>
                <span
                  data-testid="resumen-tendencia"
                  data-tendencia={ejercicio.tendencia}
                  className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${tendencia.clase}`}
                >
                  <tendencia.Icono className="h-3.5 w-3.5" aria-hidden="true" />
                  {tendencia.texto}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Hoy: {describirSeries(ejercicio.hoy)}
                {ejercicio.ultimaVez && ` · Antes: ${describirSeries(ejercicio.ultimaVez.series)}`}
              </p>
              {marcas.carga && (
                <MarcaNueva
                  tipo="carga"
                  texto={`Nueva marca de carga: ${numeroLegible(marcas.carga.valor)} kg (antes ${numeroLegible(marcas.carga.anterior)} kg)`}
                />
              )}
              {marcas.e1rm && (
                <MarcaNueva
                  tipo="e1rm"
                  texto={`Nuevo 1RM estimado: ${numeroLegible(marcas.e1rm.valor)} kg (antes ${numeroLegible(marcas.e1rm.anterior)} kg)`}
                />
              )}
              <SugerenciaProgresion sugerencia={ejercicio.proxima} prefijo="Próxima vez:" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
