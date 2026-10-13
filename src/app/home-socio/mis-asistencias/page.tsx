"use client";

import React from "react";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { AsistenciasSection } from "@/components/home-socio/asistencias-section";

/** Mis asistencias (T-039, D-45): calendario y racha desde Asistencia. */
export function MisAsistenciasPage() {
  return (
    <SocioSeccionPage active="asistencias">
      {(data) => <AsistenciasSection asistencias={data.asistencias} />}
    </SocioSeccionPage>
  );
}

export default MisAsistenciasPage;
