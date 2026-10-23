"use client";

import React from "react";
import { Trophy } from "lucide-react";
import type { SerieMarcaDTO } from "@/api/sesiones";
import { numeroLegible } from "@/domains/sesion/historial-ejercicio";
import { avisoDeRecord } from "@/domains/sesion/marcas-ejercicio";

export interface RecordEnVivoProps {
  /** Frontera de récords de las sesiones anteriores en este ejercicio (D-63). */
  frontera: SerieMarcaDTO[];
  /** Carga elegida para la serie que se está por hacer. */
  carga: number;
}

const reps = (n: number) => `${n} ${n === 1 ? "rep" : "reps"}`;

/**
 * Récord en vivo (T-046c, D-63): mientras se elige el peso de la serie, el mayor número de
 * repeticiones hecho antes con esa carga o más, o el aviso de que esa carga supera la mejor marca.
 * Se mueve con el peso; sin historial o sin carga elegida no dibuja nada.
 */
export function RecordEnVivo({ frontera, carga }: RecordEnVivoProps) {
  const aviso = avisoDeRecord(frontera, carga);
  if (!aviso) return null;

  const texto =
    aviso.tipo === "nueva-carga"
      ? `Con esta carga superás tu mejor marca (${numeroLegible(aviso.mejorCarga)} kg)`
      : aviso.record.carga === carga
        ? `Récord a ${numeroLegible(carga)} kg: ${reps(aviso.record.repeticiones)}`
        : `Récord con ${numeroLegible(carga)} kg o más: ${reps(aviso.record.repeticiones)} a ${numeroLegible(aviso.record.carga)} kg`;

  return (
    <p
      data-testid="record-en-vivo"
      data-tipo={aviso.tipo}
      className={`flex items-center gap-1.5 text-xs font-semibold ${
        aviso.tipo === "nueva-carga" ? "text-orange-700" : "text-ink-muted"
      }`}
    >
      <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {texto}
    </p>
  );
}
