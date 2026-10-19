/**
 * Peso corporal con meta (T-048, D-65). Funciones PURAS: no usan Prisma ni React, así se prueban
 * sin base y se importan desde el navegador.
 *
 * La meta guarda el peso desde el que se fijó (`inicial`). Sin él no se sabe si el objetivo era
 * bajar o subir, y pasarse de la meta por el lado correcto se mostraría como "te faltan X kg" al
 * revés. Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */
import { startOfGymDay } from "@/lib/gym-time";

/** Límites razonables para un adulto: sirven para atajar errores de tipeo (784 en vez de 78,4). */
export const PESO_MIN_KG = 20;
export const PESO_MAX_KG = 400;

/** Dentro de este margen de la meta, "mantener el peso" se considera cumplido. */
const TOLERANCIA_MANTENER_KG = 0.5;

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valida un peso en kg y lo deja con dos decimales como máximo.
 * @throws Error("VALIDATION_ERROR: ...") si no es un número o está fuera de rango.
 */
export function validarPeso(valor: unknown, campo = "El peso"): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new Error(`VALIDATION_ERROR: ${campo} tiene que ser un número`);
  }
  if (valor < PESO_MIN_KG || valor > PESO_MAX_KG) {
    throw new Error(`VALIDATION_ERROR: ${campo} tiene que estar entre ${PESO_MIN_KG} y ${PESO_MAX_KG} kg`);
  }
  return redondear2(valor);
}

export type DireccionDeMeta = "bajar" | "subir" | "mantener";

export interface ProgresoHaciaMeta {
  direccion: DireccionDeMeta;
  /** Kilos que faltan para llegar a la meta (0 si ya se alcanzó), o cuánto se alejó si era mantener. */
  faltan: number;
  alcanzada: boolean;
}

/**
 * Cómo va el socio hacia su meta. La dirección sale del peso desde el que la fijó: llegar o
 * pasarse por el lado correcto es alcanzarla.
 */
export function progresoHaciaMeta(input: {
  actual: number;
  objetivo: number;
  inicial: number;
}): ProgresoHaciaMeta {
  const { actual, objetivo, inicial } = input;

  if (objetivo < inicial) {
    return { direccion: "bajar", faltan: redondear2(Math.max(0, actual - objetivo)), alcanzada: actual <= objetivo };
  }
  if (objetivo > inicial) {
    return { direccion: "subir", faltan: redondear2(Math.max(0, objetivo - actual)), alcanzada: actual >= objetivo };
  }

  const distancia = redondear2(Math.abs(actual - objetivo));
  return { direccion: "mantener", faltan: distancia, alcanzada: distancia <= TOLERANCIA_MANTENER_KG };
}

/** Un pesaje. */
export interface PuntoDePeso {
  fecha: Date;
  peso: number;
}

/**
 * Los puntos del gráfico: de más antiguo a más reciente, con un solo pesaje por día (el último de
 * ese día, contado en hora del gimnasio) y solo los últimos `maximo`.
 */
export function puntosDelGrafico(mediciones: PuntoDePeso[], maximo = 120): PuntoDePeso[] {
  const ultimoDelDia = new Map<number, PuntoDePeso>();
  for (const m of mediciones) {
    const dia = startOfGymDay(m.fecha).getTime();
    const previo = ultimoDelDia.get(dia);
    if (!previo || m.fecha.getTime() > previo.fecha.getTime()) ultimoDelDia.set(dia, m);
  }

  return [...ultimoDelDia.values()]
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .slice(-maximo);
}

/** Cuánto cambió el peso entre el último pesaje y el anterior; `null` si hay menos de dos. */
export function variacionDelPeso(puntos: PuntoDePeso[]): number | null {
  if (puntos.length < 2) return null;
  return redondear2(puntos[puntos.length - 1].peso - puntos[puntos.length - 2].peso);
}
