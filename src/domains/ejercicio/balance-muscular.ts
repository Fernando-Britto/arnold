/**
 * Balance muscular (T-051 parte 2, D-107). Dominio PURO: sin Prisma ni React.
 *
 * Cuántas series de trabajo hizo el socio por músculo en un período, ordenado y normalizado para
 * dibujarlo en un mapa corporal. El volumen sale de `volumenPorMusculo` (D-71): el objetivo cuenta 1 y
 * cada secundario 0,4. Sirve para ver de un vistazo qué se está trabajando de más y qué se está
 * dejando de lado.
 *
 * Idea tomada de openGym como referencia (su "balance muscular" por series trabajadas y el filtro
 * Semana, 30 días, 90 días y Todo); no se copió código (AGPL-3.0).
 */
import { startOfGymDay } from "@/lib/gym-time";
import { ETIQUETAS_MUSCULO, MUSCULOS, type Musculo, type PesosMusculares } from "./musculos";

export const PERIODOS = ["semana", "30d", "90d", "todo"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const ETIQUETAS_PERIODO: Readonly<Record<Periodo, string>> = {
  semana: "Semana",
  "30d": "30 días",
  "90d": "90 días",
  todo: "Todo",
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días que cubre cada período contando hoy; `todo` no tiene límite. */
const DIAS: Readonly<Record<Exclude<Periodo, "todo">, number>> = { semana: 7, "30d": 30, "90d": 90 };

export function esPeriodo(valor: unknown): valor is Periodo {
  return typeof valor === "string" && (PERIODOS as readonly string[]).includes(valor);
}

/**
 * Desde cuándo cuenta un período: el inicio del día (en hora del gimnasio) de hace N-1 días, así hoy
 * es el primero de los N. `null` para "todo".
 */
export function desdeDelPeriodo(periodo: Periodo, ahora: Date): Date | null {
  if (periodo === "todo") return null;
  return new Date(startOfGymDay(ahora).getTime() - (DIAS[periodo] - 1) * MS_POR_DIA);
}

/** Nivel de color de 0 (sin trabajar) a 5 (lo más trabajado). Una intensidad fuera de rango no se sale de la escala. */
export function nivelDeIntensidad(intensidad: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(intensidad) || intensidad <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(intensidad * 5))) as 1 | 2 | 3 | 4 | 5;
}

export interface MusculoDelBalance {
  musculo: Musculo;
  etiqueta: string;
  /** Series de trabajo ponderadas (el secundario cuenta 0,4), con un decimal. */
  series: number;
  /** Relativa al músculo más trabajado, que vale 1. */
  intensidad: number;
}

export interface BalanceMuscular {
  periodo: Periodo;
  /** Inicio del período; `null` en "todo". */
  desde: Date | null;
  /** Series de trabajo reales hechas en el período (no ponderadas). */
  totalSeries: number;
  /** Los músculos trabajados, del más al menos trabajado. */
  musculos: MusculoDelBalance[];
  /** Los que no se trabajaron, en orden de la cabeza a los pies. */
  sinTrabajar: Musculo[];
}

const aUnDecimal = (n: number) => Math.round(n * 10) / 10;

/**
 * Ordena y normaliza el volumen por músculo. Con el mismo volumen se mantiene el orden del cuerpo
 * (de la cabeza a los pies) para que el resultado sea estable.
 */
export function armarBalance(
  volumen: PesosMusculares,
  contexto: { periodo: Periodo; desde: Date | null; totalSeries: number }
): BalanceMuscular {
  const trabajados = MUSCULOS.flatMap((musculo) => {
    const series = aUnDecimal(volumen[musculo] ?? 0);
    return series > 0 ? [{ musculo, series }] : [];
  }).sort((a, b) => b.series - a.series);

  const maximo = trabajados.length > 0 ? trabajados[0].series : 0;
  const musculos = trabajados.map(({ musculo, series }) => ({
    musculo,
    etiqueta: ETIQUETAS_MUSCULO[musculo],
    series,
    intensidad: maximo > 0 ? series / maximo : 0,
  }));

  const hechos = new Set(musculos.map((m) => m.musculo));
  return {
    periodo: contexto.periodo,
    desde: contexto.desde,
    totalSeries: contexto.totalSeries,
    musculos,
    sinTrabajar: MUSCULOS.filter((m) => !hechos.has(m)),
  };
}
