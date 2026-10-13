"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SocioSeccionPage } from "@/components/home-socio/socio-seccion-page";
import { MiRutinaSection } from "@/components/home-socio/mi-rutina-section";

/** Mi rutina (T-039, D-45): rutina asignada, historial de sesiones y retomar una en curso. */
export function MiRutinaPage() {
  const router = useRouter();

  return (
    <SocioSeccionPage active="rutina">
      {(data) => (
        <MiRutinaSection
          rutina={data.rutina}
          sesiones={data.sesiones}
          sesionEnCurso={data.sesionEnCurso}
          onSeguirRutina={() => router.push("/home-socio")}
          onVerEjercicios={() => router.push("/home-socio/mis-ejercicios")}
        />
      )}
    </SocioSeccionPage>
  );
}

export default MiRutinaPage;
