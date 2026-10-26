"use client";

import React from "react";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { BalanceMuscularCard } from "@/components/home-socio/balance-muscular-card";
import { ProgresoDetalleSection } from "@/components/home-socio/progreso-detalle-section";

/**
 * Progreso (T-039, D-45): cargas y mejores marcas en el tiempo desde RegistroDeProgreso. Arriba va el
 * balance muscular (T-051, D-107), que pide sus propios datos según el período elegido.
 */
export function ProgresoPage() {
  return (
    <SocioSeccionPage active="progreso">
      {(data) => <ProgresoDetalleSection progreso={data.progreso} extra={<BalanceMuscularCard />} />}
    </SocioSeccionPage>
  );
}

export default ProgresoPage;
