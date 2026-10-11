import type { EjercicioEnRutina } from "@prisma/client";
import { fixedDate, nextSeq } from "./sequence";

/**
 * Fila de EjercicioEnRutina. Sin overrides, `rutinaId` y `ejercicioId` son ids nuevos
 * (el par es único en el schema); pasá los ids reales para atarlo a una rutina concreta.
 */
export function buildEjercicioEnRutina(overrides: Partial<EjercicioEnRutina> = {}): EjercicioEnRutina {
  const n = nextSeq("ejercicioEnRutina");
  return {
    id: `ejercicio-en-rutina-${n}`,
    rutinaId: `rutina-${n}`,
    ejercicioId: `ejercicio-${n}`,
    series: 3,
    repeticiones: 10,
    descanso: 60,
    orden: 0,
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    ...overrides,
  };
}
