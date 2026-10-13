"use client";

import React from "react";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { MisEjerciciosSection } from "@/components/home-socio/mis-ejercicios-section";

/** Mis ejercicios (T-039, D-45): ejercicios de la rutina con descripción y mejor marca. */
export function MisEjerciciosPage() {
  return (
    <SocioSeccionPage active="ejercicios">
      {(data) => <MisEjerciciosSection ejercicios={data.ejercicios} />}
    </SocioSeccionPage>
  );
}

export default MisEjerciciosPage;
