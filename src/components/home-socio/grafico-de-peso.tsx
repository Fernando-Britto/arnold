"use client";

import React from "react";
import {
  etiquetaDeFecha,
  formatearPesoKg,
  geometriaDelGrafico,
} from "@/domains/peso/presentacion-peso";
import type { PuntoDePeso } from "@/domains/peso/peso-corporal";

/**
 * Gráfico de línea del peso corporal (T-048 parte 2, D-66). SVG propio: no hay librería de
 * gráficos en el proyecto. Toda la geometría sale de `geometriaDelGrafico` (pura y probada);
 * acá solo se dibuja.
 *
 * Accesibilidad: es una imagen con una descripción en palabras; la meta tiene su rótulo escrito
 * y se distingue por el trazo punteado, no solo por el color.
 */
export interface GraficoDePesoProps {
  /** Un pesaje por día, del más antiguo al más reciente. */
  puntos: PuntoDePeso[];
  /** kg; `null` si no hay meta. */
  meta: number | null;
}

function describir(puntos: PuntoDePeso[]): string {
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  if (puntos.length === 1) {
    return `Peso: ${formatearPesoKg(ultimo.peso)} el ${etiquetaDeFecha(ultimo.fecha)}`;
  }
  return `Evolución del peso: de ${formatearPesoKg(primero.peso)} el ${etiquetaDeFecha(primero.fecha)} a ${formatearPesoKg(ultimo.peso)} el ${etiquetaDeFecha(ultimo.fecha)}`;
}

export function GraficoDePeso({ puntos, meta }: GraficoDePesoProps) {
  const g = geometriaDelGrafico(puntos, meta);
  if (!g) return null;

  const descripcion = describir(puntos);
  const ultimo = g.puntos[g.puntos.length - 1];

  return (
    <svg
      role="img"
      aria-label={descripcion}
      viewBox={`0 0 ${g.ancho} ${g.alto}`}
      className="h-auto w-full"
    >
      <title>{descripcion}</title>

      {/* Eje de pesos: línea de guía y número a la izquierda. */}
      {g.ticks.map((t) => (
        <g key={t.valor} data-testid="marca-de-peso">
          <line
            x1={g.area.izquierda}
            x2={g.area.derecha}
            y1={t.y}
            y2={t.y}
            stroke="#E4E4E7"
            strokeWidth={1}
          />
          <text x={g.area.izquierda - 8} y={t.y + 4} textAnchor="end" fontSize={11} fill="#71717A">
            {t.etiqueta}
          </text>
        </g>
      ))}

      {/* Meta: punteada y con su rótulo. */}
      {g.metaY !== null && meta !== null && (
        <g>
          <line
            data-testid="linea-de-meta"
            x1={g.area.izquierda}
            x2={g.area.derecha}
            y1={g.metaY}
            y2={g.metaY}
            stroke="#B45309"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={g.area.derecha}
            y={g.metaY - 5}
            textAnchor="end"
            fontSize={11}
            fontWeight={700}
            fill="#B45309"
          >
            {`Meta ${formatearPesoKg(meta)}`}
          </text>
        </g>
      )}

      {g.ruta && (
        <path
          data-testid="linea-de-peso"
          d={g.ruta}
          fill="none"
          stroke="#FC4C02"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {g.puntos.map((p, i) => (
        <circle
          key={p.fecha.getTime()}
          data-testid="punto-de-peso"
          cx={p.x}
          cy={p.y}
          r={p === ultimo ? 5 : 3}
          fill={i === g.puntos.length - 1 ? "#FC4C02" : "#FFFFFF"}
          stroke="#FC4C02"
          strokeWidth={2}
        />
      ))}

      {/* Eje de tiempo: primer y último día. */}
      {g.etiquetasX.map((e, i) => (
        <text
          key={`${e.texto}-${i}`}
          x={e.x}
          y={g.alto - 8}
          textAnchor={g.etiquetasX.length === 1 ? "middle" : i === 0 ? "start" : "end"}
          fontSize={11}
          fill="#71717A"
        >
          {e.texto}
        </text>
      ))}
    </svg>
  );
}
