/**
 * Progreso de la sesión de entrenamiento (T-049, D-67). Funciones PURAS: no usan Prisma ni React,
 * así se prueban sin base y se importan desde el navegador.
 *
 * Todo se deriva de la posición de la sesión (ejercicio y serie actuales) y de lo que pide la
 * rutina; no hay contadores guardados. La sesión avanza en el orden de la rutina, así que las
 * series hechas son las de los ejercicios anteriores más las anteriores a la actual. Los
 * calentamientos no mueven la sesión (D-64) y por eso tampoco cuentan acá.
 *
 * Idea tomada de openGym como referencia (su encabezado "0:02 · 0/19 sets" y "Exercise 1 / 6");
 * no se copió código (AGPL-3.0).
 */

/** Lo que hace falta de cada ejercicio de la sesión. */
export interface EjercicioDeProgreso {
  id: string;
  series: number;
  orden: number;
}

export interface ProgresoDeSesion {
  /** Series de trabajo ya hechas. */
  hechas: number;
  /** Series que pide la rutina en total. */
  total: number;
  /** Posición (1-based) del ejercicio actual; `null` si no se lo pudo ubicar. */
  ejercicioNumero: number | null;
  ejerciciosTotal: number;
}

/** Dónde va la sesión: series hechas y ejercicio actual, contra el total de la rutina. */
export function contarProgreso(
  ejercicios: EjercicioDeProgreso[],
  ejercicioActualId: string | null,
  serieActual: number | null
): ProgresoDeSesion {
  const ordenados = [...ejercicios].sort((a, b) => a.orden - b.orden);
  const total = ordenados.reduce((suma, e) => suma + e.series, 0);
  const ejerciciosTotal = ordenados.length;

  // Sin ejercicio actual la rutina se completó.
  if (ejercicioActualId === null) {
    return {
      hechas: total,
      total,
      ejercicioNumero: ejerciciosTotal > 0 ? ejerciciosTotal : null,
      ejerciciosTotal,
    };
  }

  const indice = ordenados.findIndex((e) => e.id === ejercicioActualId);
  if (indice === -1) return { hechas: 0, total, ejercicioNumero: null, ejerciciosTotal };

  const deLosAnteriores = ordenados.slice(0, indice).reduce((suma, e) => suma + e.series, 0);
  const delActual = Math.min(Math.max((serieActual ?? 1) - 1, 0), ordenados[indice].series);

  return { hechas: deLosAnteriores + delActual, total, ejercicioNumero: indice + 1, ejerciciosTotal };
}

/** Porcentaje de series hechas, siempre entre 0 y 100 (para el ancho de la barra). */
export function porcentajeDeProgreso(hechas: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (hechas / total) * 100));
}

/** "0:02", "12:34" o "1:02:05". Un reloj desfasado o un valor inválido se leen como "0:00". */
export function formatearTranscurrido(ms: number): string {
  const segundosTotales = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;
  const ss = String(segundos).padStart(2, "0");
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, "0")}:${ss}` : `${minutos}:${ss}`;
}
