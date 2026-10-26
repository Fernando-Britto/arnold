"use client";

import React from "react";
import {
  ALTO_MAPA,
  ANCHO_MAPA,
  COLORES_POR_NIVEL,
  REGIONES,
  SILUETA,
  textoDeSeries,
  type Forma,
} from "@/domains/ejercicio/mapa-corporal";
import { nivelDeIntensidad } from "@/domains/ejercicio/balance-muscular";
import type { BalanceMuscularDTO } from "@/api/balance-muscular";

/**
 * Mapa corporal (T-051 parte 2, D-107): un cuerpo esquemático de frente y de espalda con cada músculo
 * coloreado según las series de trabajo. SVG propio: no hay librería de gráficos en el proyecto. Toda la
 * geometría sale de `@/domains/ejercicio/mapa-corporal` (datos puros y probados); acá solo se dibuja.
 *
 * Accesibilidad: el color solo no alcanza, así que es una imagen con una descripción en palabras y las
 * series de cada músculo están además en la lista que lo acompaña.
 */
export interface MapaCorporalProps {
  musculos: BalanceMuscularDTO["musculos"];
}

function descripcion(musculos: BalanceMuscularDTO["musculos"]): string {
  if (musculos.length === 0) return "Mapa corporal sin series trabajadas en este período.";
  const principales = musculos
    .slice(0, 3)
    .map((m) => `${m.etiqueta} ${textoDeSeries(m.series)}`)
    .join(", ");
  return `Mapa corporal con las series por músculo. Más trabajados: ${principales}.`;
}

function Dibujo({ forma, ...atributos }: { forma: Forma } & React.SVGProps<SVGElement>) {
  const comunes = atributos as React.SVGProps<SVGEllipseElement & SVGRectElement & SVGPolygonElement>;
  switch (forma.tipo) {
    case "elipse":
      return <ellipse cx={forma.cx} cy={forma.cy} rx={forma.rx} ry={forma.ry} {...comunes} />;
    case "rect":
      return <rect x={forma.x} y={forma.y} width={forma.ancho} height={forma.alto} rx={forma.rx} {...comunes} />;
    case "poligono":
      return <polygon points={forma.puntos.map(([x, y]) => `${x},${y}`).join(" ")} {...comunes} />;
  }
}

export function MapaCorporal({ musculos }: MapaCorporalProps) {
  const porMusculo = new Map(musculos.map((m) => [m.musculo, m]));
  const texto = descripcion(musculos);

  return (
    <svg
      role="img"
      aria-label={texto}
      viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`}
      className="h-auto w-full max-w-[320px]"
    >
      {SILUETA.map((pieza, i) => (
        <Dibujo key={`s${i}`} forma={pieza.forma} fill="#F4F4F5" stroke="#D4D4D8" strokeWidth={1} />
      ))}

      {REGIONES.map((region, i) => {
        const dato = porMusculo.get(region.musculo);
        const nivel = dato ? nivelDeIntensidad(dato.intensidad) : 0;
        return (
          <Dibujo
            key={`r${i}`}
            forma={region.forma}
            data-musculo={region.musculo}
            data-nivel={nivel}
            fill={COLORES_POR_NIVEL[nivel]}
            stroke="#A1A1AA"
            strokeWidth={0.6}
          >
            {dato && <title>{`${dato.etiqueta} · ${textoDeSeries(dato.series)}`}</title>}
          </Dibujo>
        );
      })}

      <text x={60} y={282} textAnchor="middle" fontSize={11} fill="currentColor" className="text-ink-muted">
        Frente
      </text>
      <text x={200} y={282} textAnchor="middle" fontSize={11} fill="currentColor" className="text-ink-muted">
        Espalda
      </text>
    </svg>
  );
}
