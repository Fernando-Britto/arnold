/**
 * Resumen al terminar la sesión (T-046b, D-62). Funciones PURAS: no usan Prisma ni React.
 *
 * Por cada ejercicio: lo que se hizo hoy, cómo se compara con la última vez (↑ ↓ =) y la carga
 * que se sugiere para la próxima sesión. Esa carga sale de la MISMA función que arma la sesión
 * siguiente (`sugerirProximaCarga`), contando la de hoy como historial: el resumen no promete un
 * número distinto del que después se precarga, ni siquiera cuando anticipa una descarga.
 *
 * También dice si hoy se batió una marca personal (mayor carga o mejor 1RM estimado, D-63),
 * contra TODO el historial anterior que recibe, no contra la ventana acotada de las sesiones.
 */
import { agruparSesiones } from "./historial-ejercicio";
import type { RegistroHistorico, SerieUltimaVez, SesionHistorica } from "./historial-ejercicio";
import { sugerirProximaCarga } from "./progresion-ejercicio";
import type { PrescripcionEjercicio, Sugerencia } from "./progresion-ejercicio";
import { detectarMarcasNuevas } from "./marcas-ejercicio";
import type { MarcasNuevas, SerieMarca } from "./marcas-ejercicio";

/** Cómo le fue hoy comparado con la última vez en ese ejercicio. */
export type Tendencia = "subio" | "bajo" | "igual" | "primera";

export interface ResumenEjercicio {
  ejercicioId: string;
  nombre: string;
  /** Series de hoy, en el orden en que se hicieron. */
  hoy: SerieUltimaVez[];
  /** La sesión anterior en la que hizo este ejercicio; null si es la primera vez. */
  ultimaVez: SesionHistorica | null;
  tendencia: Tendencia;
  /** Marcas personales que hoy superó (D-63). */
  marcas: MarcasNuevas;
  /** Carga para la próxima sesión, contando la de hoy. */
  proxima: Sugerencia;
}

const mayorCarga = (series: SerieUltimaVez[]) =>
  series.reduce((max, serie) => Math.max(max, serie.carga), 0);
const totalRepeticiones = (series: SerieUltimaVez[]) =>
  series.reduce((total, serie) => total + serie.repeticiones, 0);

/**
 * Las series que dicen cómo rindió: sin los drop sets, que se hacen con menos peso y más
 * repeticiones a propósito (T-047, D-64). Si no hubo otras, se usan todas.
 */
function seriesDeTrabajo(series: SerieUltimaVez[]): SerieUltimaVez[] {
  const deTrabajo = series.filter((s) => s.tipo !== "DROP_SET");
  return deTrabajo.length > 0 ? deTrabajo : series;
}

/**
 * Compara hoy con la última vez. Manda la carga de trabajo (la mayor de las series); si es la
 * misma, el total de repeticiones. Sin carga (peso corporal) cuentan solo las repeticiones. Los
 * drop sets no cuentan: sus repeticiones de más no son una mejora.
 */
export function compararConUltimaVez(
  hoy: SerieUltimaVez[],
  antes: SerieUltimaVez[] | null
): Tendencia {
  if (!antes || antes.length === 0) return "primera";
  const trabajoHoy = seriesDeTrabajo(hoy);
  const trabajoAntes = seriesDeTrabajo(antes);

  const cargaHoy = mayorCarga(trabajoHoy);
  const cargaAntes = mayorCarga(trabajoAntes);
  if (cargaHoy !== cargaAntes) return cargaHoy > cargaAntes ? "subio" : "bajo";

  const repsHoy = totalRepeticiones(trabajoHoy);
  const repsAntes = totalRepeticiones(trabajoAntes);
  if (repsHoy === repsAntes) return "igual";
  return repsHoy > repsAntes ? "subio" : "bajo";
}

export interface ResumirEjercicioInput {
  ejercicioId: string;
  nombre: string;
  /** Lo que la rutina pide en este ejercicio. */
  prescripcion: PrescripcionEjercicio;
  /** Registros del ejercicio, incluidos los de la sesión de hoy. */
  registros: RegistroHistorico[];
  /** Sesión que se está resumiendo. */
  sesionId: string;
  incrementoKg: number;
  /** Último cambio del ejercicio en la rutina; lo anterior es de otro plan (D-59). */
  planDesde?: Date | null;
  /**
   * Todas las series de sesiones ANTERIORES a esta, sin tope de antigüedad (D-63). Sin ellas no se
   * anuncian marcas: la ventana de `registros` es corta y afirmar un récord con ella puede ser falso.
   */
  seriesAnteriores?: SerieMarca[];
}

/** Resumen de un ejercicio, o `null` si en esa sesión no se hizo ninguna serie de él. */
export function resumirEjercicio(input: ResumirEjercicioInput): ResumenEjercicio | null {
  const deHoy = input.registros.filter((r) => r.sesionId === input.sesionId);
  if (deHoy.length === 0) return null;

  const hoy = agruparSesiones(deHoy)[0].series;
  const ultimaVez = agruparSesiones(input.registros, input.sesionId).at(-1) ?? null;

  return {
    ejercicioId: input.ejercicioId,
    nombre: input.nombre,
    hoy,
    ultimaVez,
    tendencia: compararConUltimaVez(hoy, ultimaVez?.series ?? null),
    marcas: detectarMarcasNuevas(hoy, input.seriesAnteriores ?? []),
    proxima: sugerirProximaCarga(
      agruparSesiones(input.registros),
      input.prescripcion,
      input.incrementoKg,
      input.planDesde ?? null
    ),
  };
}
