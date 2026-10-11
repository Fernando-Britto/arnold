import type { Ejercicio } from "@prisma/client";
import { fixedDate, nextSeq } from "./sequence";

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
    ...overrides,
  };
}
