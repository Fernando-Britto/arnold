import type { Ejercicio } from "@prisma/client";
import { fixedDate, nextSeq } from "./sequence";

/** Los campos del catálogo importado (D-70) de un ejercicio cargado a mano: todos vacíos. */
export function sinCatalogo(): Pick<
  Ejercicio,
  "datasetId" | "equipamiento" | "musculoObjetivo" | "musculosSecundarios" | "instrucciones" | "mediaId"
> {
  return { datasetId: null, equipamiento: null, musculoObjetivo: null, musculosSecundarios: [], instrucciones: [], mediaId: null };
}

/** Fila de Ejercicio como la devuelve Prisma. */
export function buildEjercicio(overrides: Partial<Ejercicio> = {}): Ejercicio {
  const n = nextSeq("ejercicio");
  return {
    id: `ejercicio-${n}`,
    nombre: `Ejercicio ${n}`,
    grupoMuscular: "Pecho",
    descripcion: null,
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    ...sinCatalogo(),
    ...overrides,
  };
}
