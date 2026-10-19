/**
 * Motor de progresión por ejercicio (T-046d, D-59). Funciones PURAS: no usan Prisma ni React.
 *
 * No se guarda ningún contador: cada vez se lee qué pasó en el historial y de ahí sale la carga
 * sugerida. Así corregir un dato corrige también la sugerencia, y la pantalla puede decir SIEMPRE
 * por qué propone ese número.
 *
 * Cómo se lee una sesión:
 * - serie hecha con las repeticiones objetivo (o más) = acierto;
 * - serie con menos repeticiones, o que no se hizo = fallo;
 * - solo cuentan las series que la rutina pide: una serie extra no sube ni arruina nada;
 * - tipos de serie (T-047, D-64): el **drop set** se ignora por completo (no ocupa una serie, no
 *   cuenta para la carga ni para el juicio): es una serie extra que cuelga de la anterior. Las
 *   series **hasta el fallo** cuentan como cualquier otra. El calentamiento ni llega acá: la
 *   consulta lo deja afuera.
 *
 * Si la rutina cambió (series o repeticiones), las sesiones anteriores al cambio se hicieron contra
 * otro plan: no se juzgan, para no descargar por un fallo que ya no es un fallo (`planDesde`).
 *
 * Qué se sugiere (progresión lineal):
 * - todas las series aciertan -> sube el incremento;
 * - algún fallo -> misma carga otra vez;
 * - `FALLOS_PARA_DESCARGAR` sesiones seguidas con fallos a la misma carga -> baja 10 %.
 */
import { numeroLegible, cargaPrecargada } from "./historial-ejercicio";
import type { SesionHistorica, UltimaVez } from "./historial-ejercicio";

export const FALLOS_PARA_DESCARGAR = 3;
export const FACTOR_DESCARGA = 0.9;

/** Lo que la rutina le pide al socio en un ejercicio (`EjercicioEnRutina`). */
export interface PrescripcionEjercicio {
  series: number;
  repeticiones: number;
}

/** Una sesión reducida a lo que el motor necesita para juzgarla. */
export interface SesionLeida {
  /** Mayor carga de las series que cuentan. 0 si no se registró carga. */
  carga: number;
  /** true si todas las series pedidas se hicieron con las repeticiones objetivo o más. */
  cumplida: boolean;
}

export type TipoSugerencia = "primera" | "subir" | "mantener" | "descargar";

export interface Sugerencia {
  tipo: TipoSugerencia;
  /** Carga sugerida en kg; null si no hay un número honesto que dar. */
  carga: number | null;
  /** Por qué se sugiere eso, listo para mostrar. */
  motivo: string;
}

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lee una sesión pasada contra lo que la rutina pide.
 *
 * El drop set cuelga de la serie anterior: no es una serie nueva. Por eso se descarta antes de
 * juzgar, no ocupa un lugar en la rutina y no aporta carga de trabajo. Así una serie floja de
 * drop no frena la progresión ni tapa una serie de trabajo que faltó.
 */
export function leerSesion(
  sesion: Pick<SesionHistorica, "series">,
  prescripcion: PrescripcionEjercicio
): SesionLeida {
  const pedidas = Math.max(1, prescripcion.series);
  const deTrabajo = sesion.series.filter((s) => s.tipo !== "DROP_SET" && s.tipo !== "CALENTAMIENTO");

  const cuentan = deTrabajo.slice(0, pedidas);
  const carga = cuentan.reduce((max, s) => Math.max(max, s.carga), 0);
  const cumplida =
    prescripcion.repeticiones > 0 &&
    deTrabajo.length >= pedidas &&
    cuentan.every((s) => s.repeticiones >= prescripcion.repeticiones);
  return { carga, cumplida };
}

/**
 * Sesiones seguidas con fallos, contando desde la más reciente (`sesiones` va de la más antigua a
 * la más reciente). Se corta con un acierto o con un cambio de carga: los fallos de antes de una
 * descarga eran de otra carga y no deben pesar sobre la nueva.
 */
export function rachaDeFallos(sesiones: SesionLeida[]): number {
  let racha = 0;
  for (let i = sesiones.length - 1; i >= 0; i--) {
    if (sesiones[i].cumplida) break;
    if (i < sesiones.length - 1 && sesiones[i].carga !== sesiones[i + 1].carga) break;
    racha++;
  }
  return racha;
}

/** 10 % menos, en una carga que se pueda armar con el incremento; siempre menor que la actual. */
function cargaDescargada(carga: number, incremento: number): number | null {
  const paso = incremento > 0 ? incremento : 2.5;
  const objetivo = redondear2(Math.round((carga * FACTOR_DESCARGA) / paso) * paso);
  const menor = objetivo >= carga ? redondear2(carga - paso) : objetivo;
  return menor >= paso ? menor : null;
}

/**
 * La carga que corresponde probar en la próxima sesión, con el motivo.
 * `sesiones` va de la más antigua a la más reciente. `planDesde` es cuándo se tocó por última vez
 * el ejercicio en la rutina (`EjercicioEnRutina.updatedAt`): lo anterior es de otro plan.
 */
export function sugerirProximaCarga(
  todas: SesionHistorica[],
  prescripcion: PrescripcionEjercicio,
  incrementoKg: number,
  planDesde?: Date | null
): Sugerencia {
  const sesiones = planDesde
    ? todas.filter((s) => s.fecha.getTime() >= planDesde.getTime())
    : todas;

  if (todas.length > 0 && sesiones.length === 0) {
    const previa = leerSesion(todas[todas.length - 1], prescripcion).carga;
    return {
      tipo: "mantener",
      carga: previa > 0 ? previa : null,
      motivo:
        "Cambió el plan de este ejercicio: mismo peso otra vez y desde ahí se retoma la progresión.",
    };
  }

  if (sesiones.length === 0) {
    return {
      tipo: "primera",
      carga: null,
      motivo: "Primera vez con este ejercicio: esta sesión marca tu punto de partida.",
    };
  }

  const leidas = sesiones.map((s) => leerSesion(s, prescripcion));
  const ultima = leidas[leidas.length - 1];

  if (ultima.carga <= 0) {
    return {
      tipo: "mantener",
      carga: null,
      motivo: "No hay una carga registrada la última vez, así que no hay un peso para sugerir.",
    };
  }

  if (ultima.cumplida) {
    return {
      tipo: "subir",
      carga: redondear2(ultima.carga + incrementoKg),
      motivo: `Hiciste todas las repeticiones la última vez: +${numeroLegible(incrementoKg)} kg.`,
    };
  }

  const racha = rachaDeFallos(leidas);
  if (racha >= FALLOS_PARA_DESCARGAR) {
    const baja = cargaDescargada(ultima.carga, incrementoKg);
    if (baja === null) {
      return {
        tipo: "mantener",
        carga: ultima.carga,
        motivo: "Ya estás en la carga más baja posible: mismo peso otra vez.",
      };
    }
    return {
      tipo: "descargar",
      carga: baja,
      motivo: `${racha} sesiones seguidas sin llegar a las repeticiones: bajá a ${numeroLegible(baja)} kg y volvé a subir.`,
    };
  }

  const faltan = FALLOS_PARA_DESCARGAR - racha;
  return {
    tipo: "mantener",
    carga: ultima.carga,
    motivo: `No llegaste a todas las repeticiones la última vez: mismo peso otra vez. Con ${faltan} ${faltan === 1 ? "intento" : "intentos"} más sin lograrlo, se baja el peso.`,
  };
}

/**
 * Carga con la que arranca la serie `numeroSerie`. Si hay que subir o bajar, todas las series
 * arrancan en la carga sugerida; si hay que mantener, cada serie repite la de la última vez.
 * Así la app precarga exactamente el número que dice sugerir.
 */
export function cargaInicial(
  ultimaVez: Pick<UltimaVez, "series"> | null,
  sugerencia: Sugerencia | null,
  numeroSerie: number
): number | null {
  if (sugerencia && (sugerencia.tipo === "subir" || sugerencia.tipo === "descargar")) {
    return sugerencia.carga;
  }
  return cargaPrecargada(ultimaVez, numeroSerie);
}
