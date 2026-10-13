"use client";

import React from "react";
import { KioscoPuerta } from "@/components/acceso/kiosco-puerta";
import {
  SetupDispositivo,
  useTokenDispositivo,
  borrarTokenDispositivo,
} from "@/components/acceso/setup-dispositivo";

/**
 * Página "/puerta" (T-036, D-43 propuesta 4): pantalla del molinete. Se usa SIN sesión de usuario;
 * si no hay token configurado ofrece el alta del dispositivo, y con token monta el kiosco.
 */
export function PuertaPage() {
  const token = useTokenDispositivo();

  if (!token) return <SetupDispositivo />;

  return <KioscoPuerta token={token} onReconfigurar={() => borrarTokenDispositivo()} />;
}

export default PuertaPage;
