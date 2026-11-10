"use client";

/**
 * Contenedor de la sugerencia de asignación (T-057d, D-122).
 *
 * Es el único punto que usa el hook: la tarjeta sigue siendo presentación pura. La página lo monta
 * solo cuando corresponde (D-118), así que si no se monta no hay consulta.
 *
 * `decidir` todavía no existe: las acciones se cablean en S3.
 */
import React from "react";
import { TarjetaSugerencia } from "./tarjeta-sugerencia";
import { useSugerenciaAsignacion } from "./use-sugerencia-asignacion";

export function SugerenciaAsignacion() {
  const { estado, consultar } = useSugerenciaAsignacion();

  return <TarjetaSugerencia estado={estado} onConsultar={consultar} />;
}
