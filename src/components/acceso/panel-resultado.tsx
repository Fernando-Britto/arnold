"use client";

import React from "react";
import type { ResultadoAcceso } from "@/domains/acceso/check-in";

/** El panel de resultado se limpia solo para el próximo socio (D-47). */
export const MS_AUTO_CLEAR = 5000;

/** Datos mínimos que el panel sabe mostrar, vengan de recepción o de la puerta. */
export interface ResultadoPanelData {
  resultado: ResultadoAcceso;
  motivo?: string;
  nombre?: string;
  membresia?: string | null;
}

export function tituloDe(resultado: ResultadoAcceso): string {
  if (resultado === "PERMITIDO") return "Acceso permitido";
  if (resultado === "PERMITIDO_CON_AVISO") return "Acceso permitido con aviso";
  return "Acceso denegado";
}

/**
 * Panel de resultado compartido (T-035 recepción / T-036 puerta). `mostrarMembresia` permite
 * recortar los datos en la puerta, donde no debe verse más que el nombre y el estado (D-43).
 */
export function PanelResultado({
  resultado,
  mostrarMembresia = true,
}: {
  resultado: ResultadoPanelData;
  mostrarMembresia?: boolean;
}) {
  const permitido = resultado.resultado !== "DENEGADO";
  const conAviso = resultado.resultado === "PERMITIDO_CON_AVISO";
  const contenedor = permitido
    ? conAviso
      ? "border-warning bg-warning-soft text-warning"
      : "border-success bg-success-soft text-success"
    : "border-danger bg-danger-soft text-danger";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full max-w-xl flex-col items-center gap-2 rounded-2xl border-4 px-8 py-10 text-center ${contenedor}`}
    >
      <p className="text-2xl font-semibold">{tituloDe(resultado.resultado)}</p>
      {resultado.nombre && <p className="text-5xl font-bold">{resultado.nombre}</p>}
      {mostrarMembresia && resultado.membresia && <p className="text-lg">{resultado.membresia}</p>}
      {resultado.motivo && <p className="text-xl">{resultado.motivo}</p>}
    </div>
  );
}
