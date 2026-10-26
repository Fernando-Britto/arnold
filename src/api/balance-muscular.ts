/**
 * Balance muscular del socio (T-051 parte 2, D-107): handler del servidor y llamada del navegador.
 * Las reglas viven en `@/domains/ejercicio`; acá solo se conectan con la ruta y la pantalla.
 */
import type { Periodo } from "@/domains/ejercicio/balance-muscular";
import { balanceMuscularDelSocio } from "@/domains/ejercicio/balance-muscular-datos";
import type { Musculo } from "@/domains/ejercicio/musculos";
import { throwIfNotOk } from "@/utils/api-error";

/** El balance muscular tal como viaja por la red: la fecha de inicio es texto. */
export interface BalanceMuscularDTO {
  periodo: Periodo;
  /** Inicio del período; `null` en "todo". */
  desde: string | null;
  /** Series de trabajo reales del período (no ponderadas). */
  totalSeries: number;
  /** Los músculos trabajados, del más al menos trabajado. */
  musculos: Array<{ musculo: Musculo; etiqueta: string; series: number; intensidad: number }>;
  /** Los que no se trabajaron, de la cabeza a los pies. */
  sinTrabajar: Musculo[];
}

/** Handle GET /api/home-socio/musculos. El socio sale del token, el período de la URL ya validado. */
export async function handleBalanceMuscular(input: {
  socioId: string;
  periodo: Periodo;
}): Promise<BalanceMuscularDTO> {
  const balance = await balanceMuscularDelSocio({ socioId: input.socioId, periodo: input.periodo });
  return { ...balance, desde: balance.desde ? balance.desde.toISOString() : null };
}

/** GET /api/home-socio/musculos?periodo=... */
export async function fetchBalanceMuscular(periodo: Periodo): Promise<BalanceMuscularDTO> {
  const response = await fetch(`/api/home-socio/musculos?periodo=${periodo}`);
  await throwIfNotOk(response, "No se pudo cargar el balance muscular");
  return response.json();
}
