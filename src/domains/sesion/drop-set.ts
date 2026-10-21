/**
 * Drop sets colgados de una serie (P-46, D-69). Funciones PURAS.
 *
 * Un drop set son repeticiones extra con menos carga, hechas enseguida de una serie. No es una
 * serie de la rutina: cuelga de la que se acaba de hacer, no mueve la sesión y la progresión lo
 * ignora (ver `progresion-ejercicio.ts`). Así lo trata openGym: el drop cuelga de la fila de la
 * serie ("misma tarjeta, no una serie nueva con su propio descanso largo").
 */

/** Cuánto de la carga anterior se mantiene en el drop: un 20 % menos. */
export const FACTOR_DE_DROP = 0.8;

/** Disco más chico, en kg: el paso con el que se redondea y se ajusta la carga. */
export const PASO_DE_CARGA_KG = 2.5;

/**
 * Carga con la que se precarga el próximo drop: un 20 % menos que la anterior, redondeada al disco
 * más cercano. Siempre baja (un drop que no baja no es un drop) y nunca es negativa.
 */
export function cargaSugeridaDeDrop(cargaPrevia: number, paso: number = PASO_DE_CARGA_KG): number {
  if (!Number.isFinite(cargaPrevia) || cargaPrevia <= 0) return 0;

  const redondeada = Math.round((cargaPrevia * FACTOR_DE_DROP) / paso) * paso;
  // Con cargas chicas el redondeo puede devolver la misma carga: se resta un disco.
  const baja = redondeada < cargaPrevia ? redondeada : cargaPrevia - paso;
  return Math.max(0, baja);
}
