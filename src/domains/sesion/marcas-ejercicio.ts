/**
 * Marcas personales por ejercicio (T-046c, D-63). Funciones PURAS: no usan Prisma ni React.
 *
 * - 1RM estimado con Epley (peso × (1 + repeticiones / 30)), solo hasta `TOPE_REPS_1RM`
 *   repeticiones: más allá la fórmula deja de ser fiable y la serie no entra al estimado.
 * - Una marca es NUEVA si lo de hoy supera todo lo anterior. Sin historial previo no hay marca:
 *   la primera vez es el punto de partida, no un récord.
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */

/** Más repeticiones que esto y Epley deja de ser fiable. */
export const TOPE_REPS_1RM = 12;

/** Una serie reducida a lo que importa para las marcas. */
export interface SerieMarca {
  carga: number;
  repeticiones: number;
}

export interface MarcaNueva {
  valor: number;
  anterior: number;
}

export interface MarcasNuevas {
  /** Mayor carga levantada en el ejercicio. */
  carga: MarcaNueva | null;
  /** Mejor 1RM estimado (redondeado a 0,5 kg). */
  e1rm: MarcaNueva | null;
}

/**
 * 1RM estimado de una serie, o `null` si no se puede estimar (sin carga, sin repeticiones o por
 * encima del tope). Con una repetición el 1RM es la carga misma: Epley la inflaría un 3 %.
 */
export function estimar1RM(carga: number, repeticiones: number): number | null {
  if (carga <= 0 || repeticiones < 1 || repeticiones > TOPE_REPS_1RM) return null;
  if (repeticiones === 1) return carga;
  return carga * (1 + repeticiones / 30);
}

/** Al 0,5 kg más cercano: una estimación no tiene más precisión que esa. */
export function redondearMedioKg(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Mayor carga y mayor 1RM estimado (redondeado) de un conjunto de series. */
export function mejoresMarcas(series: SerieMarca[]): { mejorCarga: number; mejor1RM: number | null } {
  let mejorCarga = 0;
  let mejor1RM: number | null = null;

  for (const serie of series) {
    if (serie.carga <= 0) continue;
    mejorCarga = Math.max(mejorCarga, serie.carga);
    const estimado = estimar1RM(serie.carga, serie.repeticiones);
    if (estimado !== null) {
      const redondeado = redondearMedioKg(estimado);
      mejor1RM = mejor1RM === null ? redondeado : Math.max(mejor1RM, redondeado);
    }
  }
  return { mejorCarga, mejor1RM };
}

/**
 * Marcas que lo de hoy le gana a todo lo anterior. Se comparan los valores ya redondeados, así
 * nunca se anuncia "116,5 kg (antes 116,5 kg)". Sin series anteriores con carga no hay con qué
 * comparar y no se anuncia nada.
 */
export function detectarMarcasNuevas(hoy: SerieMarca[], anteriores: SerieMarca[]): MarcasNuevas {
  const antes = mejoresMarcas(anteriores);
  const ahora = mejoresMarcas(hoy);

  return {
    carga:
      antes.mejorCarga > 0 && ahora.mejorCarga > antes.mejorCarga
        ? { valor: ahora.mejorCarga, anterior: antes.mejorCarga }
        : null,
    e1rm:
      antes.mejor1RM !== null && ahora.mejor1RM !== null && ahora.mejor1RM > antes.mejor1RM
        ? { valor: ahora.mejor1RM, anterior: antes.mejor1RM }
        : null,
  };
}

/**
 * Las series que ninguna otra supera a la vez en carga y en repeticiones, ordenadas por carga
 * (D-63). Es lo mínimo que hace falta para saber el récord de repeticiones a cualquier carga: una
 * serie fuera de la frontera nunca puede ser el récord de nada. Ignora las series sin carga.
 */
export function fronteraDeRecords(series: SerieMarca[]): SerieMarca[] {
  const conCarga = series.filter((s) => s.carga > 0);
  const frontera = conCarga.filter(
    (s) =>
      !conCarga.some(
        (o) =>
          o.carga >= s.carga &&
          o.repeticiones >= s.repeticiones &&
          (o.carga > s.carga || o.repeticiones > s.repeticiones)
      )
  );

  // Se copian solo los dos campos: la entrada puede traer más (sesionId, rir) y esto va al navegador.
  const unicas = new Map(
    frontera.map((s) => [`${s.carga}|${s.repeticiones}`, { carga: s.carga, repeticiones: s.repeticiones }])
  );
  return [...unicas.values()].sort((a, b) => a.carga - b.carga);
}

/**
 * El récord a superar con una carga: el mayor número de repeticiones hecho con esa carga o más;
 * si hay empate, el de la carga más pesada. `null` si nunca se levantó tanto.
 */
export function recordConCarga(frontera: SerieMarca[], carga: number): SerieMarca | null {
  let mejor: SerieMarca | null = null;
  for (const serie of frontera) {
    if (serie.carga < carga) continue;
    if (!mejor || serie.repeticiones > mejor.repeticiones) mejor = serie;
    else if (serie.repeticiones === mejor.repeticiones && serie.carga > mejor.carga) mejor = serie;
  }
  return mejor;
}

/** Lo que se le dice al socio, mientras elige la carga de la serie, sobre sus marcas. */
export type AvisoDeRecord =
  /** El récord de repeticiones a superar con esta carga o más. */
  | { tipo: "record"; record: SerieMarca }
  /** Esta carga es más pesada que todo lo que levantó antes en el ejercicio. */
  | { tipo: "nueva-carga"; mejorCarga: number };

/**
 * Aviso en vivo para la carga elegida (D-63). Sin historial o sin carga no hay nada que decir:
 * la primera vez no se compara contra nadie.
 */
export function avisoDeRecord(frontera: SerieMarca[], carga: number): AvisoDeRecord | null {
  if (carga <= 0 || frontera.length === 0) return null;

  const record = recordConCarga(frontera, carga);
  if (record) return { tipo: "record", record };
  return { tipo: "nueva-carga", mejorCarga: frontera[frontera.length - 1].carga };
}
