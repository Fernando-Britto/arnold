/**
 * Historial por ejercicio para el tracking del socio (D-58). Funciones PURAS: no usan Prisma ni
 * React, así se prueban sin base y se importan desde el navegador.
 *
 * "Última vez" = las series de la sesión anterior en la que el socio hizo ese ejercicio. No hay
 * contadores guardados: se deriva siempre del historial (`RegistroDeProgreso`), así corregir un
 * dato corrige también lo que se muestra.
 */
import { startOfGymDay } from "@/lib/gym-time";
import { etiquetaDeTipo } from "./tipo-serie";
import type { TipoSerie } from "./tipo-serie";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fila de `RegistroDeProgreso` con lo mínimo que necesita el historial. */
export interface RegistroHistorico {
  carga: number;
  repeticiones: number;
  rir: number | null;
  /** Número de serie dentro de la sesión (1-based); null en registros anteriores a D-48. */
  numeroSerie: number | null;
  fecha: Date;
  /** Sesión a la que pertenece; null en registros anteriores a D-48. */
  sesionId: string | null;
  /** Tipo de serie (D-64); sin él es NORMAL, como el historial anterior. */
  tipo?: TipoSerie;
}

export interface SerieUltimaVez {
  carga: number;
  repeticiones: number;
  rir: number | null;
  /** Solo si no es una serie normal (D-64): así el historial anterior queda igual. */
  tipo?: TipoSerie;
}

export interface UltimaVez {
  /** Fecha de la serie más reciente de esa sesión. */
  fecha: Date;
  /** Series de la sesión, en el orden en que se hicieron. */
  series: SerieUltimaVez[];
}

function ordenarSeries(a: RegistroHistorico, b: RegistroHistorico): number {
  if (a.numeroSerie !== null && b.numeroSerie !== null && a.numeroSerie !== b.numeroSerie) {
    return a.numeroSerie - b.numeroSerie;
  }
  return a.fecha.getTime() - b.fecha.getTime();
}

/** Una sesión pasada de un ejercicio: cuándo fue y las series que se hicieron. */
export interface SesionHistorica {
  /** Fecha de la serie más reciente de la sesión. */
  fecha: Date;
  /** Series de la sesión, en el orden en que se hicieron. */
  series: SerieUltimaVez[];
}

/**
 * Todas las sesiones pasadas de UN ejercicio, de la más antigua a la más reciente (D-59).
 *
 * - Se ignora la sesión en curso (`sesionActualId`): el historial es siempre de otras sesiones.
 * - Una sesión se agrupa por `sesionId`. Los registros viejos sin sesión (`sesionId` null) se
 *   agrupan por día del gimnasio, porque es lo más cercano a "una sesión" que se puede inferir.
 */
export function agruparSesiones(
  registros: RegistroHistorico[],
  sesionActualId?: string | null
): SesionHistorica[] {
  const grupos = new Map<string, RegistroHistorico[]>();
  for (const r of registros) {
    if (sesionActualId && r.sesionId === sesionActualId) continue;
    const clave = r.sesionId ?? `dia:${startOfGymDay(r.fecha).getTime()}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(r);
    else grupos.set(clave, [r]);
  }

  return [...grupos.values()]
    .map((grupo) => {
      const ordenado = [...grupo].sort(ordenarSeries);
      const fecha = grupo.reduce((a, b) => (b.fecha.getTime() > a.fecha.getTime() ? b : a)).fecha;
      return {
        fecha,
        series: ordenado.map((r) => ({
          carga: r.carga,
          repeticiones: r.repeticiones,
          rir: r.rir,
          ...(r.tipo && r.tipo !== "NORMAL" ? { tipo: r.tipo } : {}),
        })),
      };
    })
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

/** Series de la sesión anterior para UN ejercicio, o `null` si nunca lo hizo. */
export function agruparUltimaVez(
  registros: RegistroHistorico[],
  sesionActualId?: string | null
): UltimaVez | null {
  return agruparSesiones(registros, sesionActualId).at(-1) ?? null;
}

/**
 * Las series de una sesión en una línea corta (T-046b, D-62): si son todas iguales, "3 × 10 a
 * 40 kg"; si difieren, una por una. Sin carga (peso corporal) no se inventan kilos.
 */
export function describirSeries(series: SerieUltimaVez[]): string {
  if (series.length === 0) return "";

  const [primera] = series;
  // Una serie de otro tipo (drop set, al fallo) no se esconde bajo el resumen de las demás.
  const iguales = series.every(
    (s) =>
      s.carga === primera.carga &&
      s.repeticiones === primera.repeticiones &&
      etiquetaDeTipo(s.tipo) === etiquetaDeTipo(primera.tipo)
  );
  if (iguales && !etiquetaDeTipo(primera.tipo)) {
    const carga = primera.carga > 0 ? ` a ${numeroLegible(primera.carga)} kg` : "";
    return `${series.length} × ${primera.repeticiones}${carga}`;
  }
  return series
    .map((s) => {
      const base =
        s.carga > 0 ? `${numeroLegible(s.carga)} kg × ${s.repeticiones}` : `${s.repeticiones} reps`;
      const etiqueta = etiquetaDeTipo(s.tipo);
      return etiqueta ? `${base} (${etiqueta})` : base;
    })
    .join(", ");
}

/**
 * Carga con la que precargar la serie `numeroSerie`: la misma serie de la última vez o, si
 * entonces hizo menos series, la última que hizo. `null` si no hay historial.
 *
 * El drop set y el calentamiento no ocupan una serie: se descartan para no precargar con la carga
 * reducida de un drop (D-64).
 */
export function cargaPrecargada(
  ultimaVez: Pick<UltimaVez, "series"> | null,
  numeroSerie: number
): number | null {
  const deTrabajo = (ultimaVez?.series ?? []).filter(
    (s) => s.tipo !== "DROP_SET" && s.tipo !== "CALENTAMIENTO"
  );
  if (deTrabajo.length === 0) return null;
  const indice = Math.min(Math.max(numeroSerie, 1), deTrabajo.length) - 1;
  return deTrabajo[indice].carga;
}

/** Número con coma decimal y sin ceros de más: 42.5 -> "42,5". */
export function numeroLegible(n: number): string {
  return Number(n.toFixed(2)).toString().replace(".", ",");
}

/** "42,5 kg × 8 · RIR 2 · drop set". Sin carga (peso corporal) queda "12 reps". */
export function formatearSerie(serie: SerieUltimaVez): string {
  const base =
    serie.carga > 0
      ? `${numeroLegible(serie.carga)} kg × ${serie.repeticiones}`
      : `${serie.repeticiones} reps`;
  const conRir = serie.rir !== null ? `${base} · RIR ${serie.rir}` : base;
  const etiqueta = etiquetaDeTipo(serie.tipo);
  return etiqueta ? `${conRir} · ${etiqueta}` : conRir;
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas", "hace 3 meses" (por días del gimnasio). */
export function describirHace(fecha: Date, ahora: Date): string {
  const dias = Math.round(
    (startOfGymDay(ahora).getTime() - startOfGymDay(fecha).getTime()) / MS_POR_DIA
  );
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}
