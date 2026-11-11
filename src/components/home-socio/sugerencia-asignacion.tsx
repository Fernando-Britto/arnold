"use client";

/**
 * Contenedor de la sugerencia de asignación (T-057d/T-057e, D-122).
 *
 * Es el único punto que usa el hook: la tarjeta sigue siendo presentación pura. La página lo monta
 * solo cuando corresponde (D-118), así que si no se monta no hay consulta.
 */
import React from "react";
import { TarjetaSugerencia } from "./tarjeta-sugerencia";
import { useSugerenciaAsignacion } from "./use-sugerencia-asignacion";

export interface SugerenciaAsignacionProps {
  /** La misma acción que "Seguir rutina" del hero: abre la ejecución de la rutina. */
  onSeguirRutina: () => void;
}

export function SugerenciaAsignacion({ onSeguirRutina }: SugerenciaAsignacionProps) {
  const { estado, enviando, consultar, decidir } = useSugerenciaAsignacion();

  return (
    <TarjetaSugerencia
      estado={estado}
      enviando={enviando}
      onAceptar={() => void decidir("ACEPTAR")}
      onEsperar={() => void decidir("ESPERAR")}
      onConsultar={consultar}
      onEmpezar={onSeguirRutina}
    />
  );
}
