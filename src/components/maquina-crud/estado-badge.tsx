"use client";

import React from "react";
import { TableStatusBadge } from "@/components/ui/table";
import type { EstadoMaquina } from "@/domains/maquina/maquina";

const ESTADO_VARIANT: Record<EstadoMaquina, "success" | "warning" | "danger" | "neutral"> = {
  DISPONIBLE: "success",
  OCUPADA: "warning",
  FUERA_DE_SERVICIO: "danger",
  INACTIVA: "neutral",
};

const ESTADO_LABEL: Record<EstadoMaquina, string> = {
  DISPONIBLE: "Disponible",
  OCUPADA: "Ocupada",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  INACTIVA: "Inactiva",
};

export function EstadoBadge({ estado }: { estado: EstadoMaquina }) {
  return <TableStatusBadge variant={ESTADO_VARIANT[estado]}>{ESTADO_LABEL[estado]}</TableStatusBadge>;
}
