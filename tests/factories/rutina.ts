import { NivelDeDificultad, type Rutina } from "@prisma/client";
import { fixedDate, nextSeq } from "./sequence";

/** Fila de Rutina como la devuelve Prisma (sin sus ejercicios). */
export function buildRutina(overrides: Partial<Rutina> = {}): Rutina {
  const n = nextSeq("rutina");
  return {
    id: `rutina-${n}`,
    nombre: `Rutina ${n}`,
    objetivoPrincipal: "Fuerza",
    frecuenciaSemanal: 3,
    duracionEstimada: 60,
    nivelDeDificultad: NivelDeDificultad.BASICO,
    descripcion: null,
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    ...overrides,
  };
}
