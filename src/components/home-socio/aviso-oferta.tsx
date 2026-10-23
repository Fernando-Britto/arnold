"use client";

import React from "react";

/**
 * Aviso de oferta de reactivación en Home_Socio (T-045d, D-54). Presentacional: recibe solo el
 * porcentaje y no renderiza nada cuando no hay oferta (`descuentoPct` null).
 */
export interface AvisoOfertaReactivacionProps {
  descuentoPct: number | null;
}

export function AvisoOfertaReactivacion({ descuentoPct }: AvisoOfertaReactivacionProps) {
  if (descuentoPct === null) return null;

  return (
    <div
      data-testid="aviso-oferta-reactivacion"
      role="status"
      className="rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning"
    >
      Tenés una oferta de reactivación: {descuentoPct} % de descuento en tu próxima cuota.
      Acercate a recepción para aprovecharla.
    </div>
  );
}
