"use client";

import React from "react";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { PagosSection } from "@/components/home-socio/pagos-section";

/** Mis pagos y membresía (T-039, D-45): historial, cobertura y estado calculado (D-40). */
export function MiMembresiaPage() {
  return (
    <SocioSeccionPage active="membresia">
      {(data) => <PagosSection membresia={data.membresia} />}
    </SocioSeccionPage>
  );
}

export default MiMembresiaPage;
