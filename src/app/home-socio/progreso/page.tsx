"use client";

import React from "react";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { ProgresoDetalleSection } from "@/components/home-socio/progreso-detalle-section";

/** Progreso (T-039, D-45): cargas y mejores marcas en el tiempo desde RegistroDeProgreso. */
export function ProgresoPage() {
  return (
    <SocioSeccionPage active="progreso">
      {(data) => <ProgresoDetalleSection progreso={data.progreso} />}
    </SocioSeccionPage>
  );
}

export default ProgresoPage;
