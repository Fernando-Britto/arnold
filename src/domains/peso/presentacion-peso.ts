/**
 * Presentación del peso corporal (T-048 parte 2, D-66). Funciones PURAS: no usan Prisma ni React,
 * así se prueban sin base y se importan desde el navegador.
 *
 * Acá vive todo lo que decide QUÉ se ve (los textos, la lectura de lo que escribe el socio y la
 * geometría del gráfico); los componentes solo lo dibujan. Las reglas de negocio (rangos,
 * dirección de la meta, puntos por día) están en `peso-corporal.ts`.
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */
import { toGymWallClock } from "@/lib/gym-time";
import type { ProgresoHaciaMeta, PuntoDePeso } from "./peso-corporal";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 78,4 → "78,4"; 80 → "80". Dos decimales como máximo y coma decimal. */
function numeroLegible(n: number): string {
  return Number(n.toFixed(2)).toString().replace(".", ",");
}

/** "78,4 kg". */
export function formatearPesoKg(n: number): string {
  return `${numeroLegible(n)} kg`;
}

/**
 * Lee lo que el socio escribió en el campo de peso. Acepta coma o punto decimal ("78,4" o "78.4").
 * Devuelve `null` si no es un número simple. El rango (20 a 400 kg) NO se mira acá: lo valida
 * `validarPeso`, que es la misma regla que aplica el servidor.
 */
export function parsearPesoIngresado(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(",", "."));
}

/** La línea de la meta: lo que falta, o que ya se alcanzó, según hacia dónde iba. */
export function describirMeta(progreso: ProgresoHaciaMeta, objetivo: number): string {
  if (progreso.direccion === "mantener") {
    return progreso.alcanzada
      ? `Meta: mantener ${formatearPesoKg(objetivo)} · estás dentro del margen`
      : `Meta: mantener ${formatearPesoKg(objetivo)} · estás a ${formatearPesoKg(progreso.faltan)}`;
  }
  return progreso.alcanzada
    ? `Meta ${formatearPesoKg(objetivo)} · ¡alcanzada!`
    : `Meta ${formatearPesoKg(objetivo)} · te faltan ${formatearPesoKg(progreso.faltan)}`;
}

export type SentidoDeVariacion = "baja" | "sube" | "igual";

/**
 * La variación contra el pesaje anterior, dicha con palabras: el sentido no depende de un signo
 * ni de un color. `null` si hay menos de dos pesajes.
 */
export function describirVariacion(
  variacion: number | null
): { texto: string; sentido: SentidoDeVariacion } | null {
  if (variacion === null) return null;
  if (variacion < 0) return { texto: `bajó ${formatearPesoKg(-variacion)}`, sentido: "baja" };
  if (variacion > 0) return { texto: `subió ${formatearPesoKg(variacion)}`, sentido: "sube" };
  return { texto: "igual que el pesaje anterior", sentido: "igual" };
}

/** "12 sep": día y mes cortos en hora del gimnasio. Sin `Intl`, para que no dependa del equipo. */
export function etiquetaDeFecha(fecha: Date): string {
  const local = toGymWallClock(fecha);
  return `${local.getUTCDate()} ${MESES[local.getUTCMonth()]}`;
}

export interface GeometriaDelGrafico {
  ancho: number;
  alto: number;
  /** Rectángulo donde se dibujan los datos, dentro de los márgenes. */
  area: { izquierda: number; derecha: number; arriba: number; abajo: number };
  puntos: Array<{ x: number; y: number; peso: number; fecha: Date }>;
  /** Trazo de la línea ("M x,y L x,y ..."); vacío si hay un solo punto. */
  ruta: string;
  /** Altura de la línea de la meta; `null` si no hay meta. */
  metaY: number | null;
  /** Marcas del eje de pesos, de arriba hacia abajo (peso mayor primero). */
  ticks: Array<{ valor: number; y: number; etiqueta: string }>;
  /** Primer y último día del gráfico. */
  etiquetasX: Array<{ x: number; texto: string }>;
}

const DIMENSIONES = { ancho: 640, alto: 220 };
const MARGENES = { izquierda: 44, derecha: 16, arriba: 12, abajo: 28 };
/** Saltos "redondos" para el eje; todos múltiplos de 0,5 kg. */
const PASOS = [0.5, 1, 2, 2.5, 5, 10, 20, 50];

const redondear1 = (n: number) => Math.round(n * 10) / 10;

function marcasDelEje(dMin: number, dMax: number): number[] {
  for (const paso of PASOS) {
    const valores: number[] = [];
    for (let v = Math.ceil(dMin / paso) * paso; v <= dMax + 1e-9; v += paso) valores.push(v);
    if (valores.length >= 2 && valores.length <= 5) return valores;
  }
  return [dMin, dMax];
}

/**
 * Convierte los pesajes (y la meta, si hay) en coordenadas listas para dibujar un gráfico de
 * línea. El eje de tiempo es proporcional a las fechas y la escala de pesos deja un margen y
 * tiene al menos 1 kg de alto, para que pesajes casi iguales no queden aplastados. La meta
 * siempre entra en la escala. Devuelve `null` si no hay pesajes.
 */
export function geometriaDelGrafico(
  puntos: PuntoDePeso[],
  meta: number | null
): GeometriaDelGrafico | null {
  if (puntos.length === 0) return null;

  const { ancho, alto } = DIMENSIONES;
  const area = {
    izquierda: MARGENES.izquierda,
    derecha: ancho - MARGENES.derecha,
    arriba: MARGENES.arriba,
    abajo: alto - MARGENES.abajo,
  };

  const ordenados = [...puntos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const pesos = ordenados.map((p) => p.peso);
  if (meta !== null) pesos.push(meta);

  let min = Math.min(...pesos);
  let max = Math.max(...pesos);
  if (max - min < 1) {
    const centro = (max + min) / 2;
    min = centro - 0.5;
    max = centro + 0.5;
  }
  const relleno = (max - min) * 0.1;
  const dMin = min - relleno;
  const dMax = max + relleno;

  const yDe = (peso: number) =>
    area.abajo - ((peso - dMin) / (dMax - dMin)) * (area.abajo - area.arriba);

  const tMin = ordenados[0].fecha.getTime();
  const tMax = ordenados[ordenados.length - 1].fecha.getTime();
  const xDe = (fecha: Date) =>
    tMax === tMin
      ? (area.izquierda + area.derecha) / 2
      : area.izquierda + ((fecha.getTime() - tMin) / (tMax - tMin)) * (area.derecha - area.izquierda);

  const dibujados = ordenados.map((p) => ({ x: xDe(p.fecha), y: yDe(p.peso), peso: p.peso, fecha: p.fecha }));
  const ruta =
    dibujados.length < 2
      ? ""
      : dibujados
          .map((p, i) => `${i === 0 ? "M" : "L"}${redondear1(p.x)},${redondear1(p.y)}`)
          .join(" ");

  const ticks = marcasDelEje(dMin, dMax)
    .map((valor) => ({ valor, y: yDe(valor), etiqueta: numeroLegible(valor) }))
    .sort((a, b) => b.valor - a.valor);

  const primero = dibujados[0];
  const ultimo = dibujados[dibujados.length - 1];
  const etiquetasX =
    dibujados.length === 1
      ? [{ x: primero.x, texto: etiquetaDeFecha(primero.fecha) }]
      : [
          { x: primero.x, texto: etiquetaDeFecha(primero.fecha) },
          { x: ultimo.x, texto: etiquetaDeFecha(ultimo.fecha) },
        ];

  return { ancho, alto, area, puntos: dibujados, ruta, metaY: meta === null ? null : yDe(meta), ticks, etiquetasX };
}
