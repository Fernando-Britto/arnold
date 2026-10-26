/**
 * Geometría del mapa corporal (T-051 parte 2, D-107). Datos PUROS: sin React ni Prisma.
 *
 * Un cuerpo esquemático visto de frente (izquierda) y de espalda (derecha), con una zona por cada
 * músculo. Está dibujado con elipses, rectángulos y polígonos simples: no pretende ser anatómico, solo
 * dejar ver de un vistazo qué zonas se trabajaron. Los músculos pares (pecho, bíceps, cuádriceps…) se
 * dibujan los dos lados, espejados. Los que se ven de ambos lados (hombros, trapecios, antebrazos)
 * aparecen en las dos vistas y se colorean igual.
 *
 * El dibujo es propio, trazado a mano para esta aplicación; no se copiaron los de openGym (AGPL-3.0).
 */
import type { Musculo } from "./musculos";

export const ANCHO_MAPA = 260;
export const ALTO_MAPA = 290;

export type Forma =
  | { tipo: "elipse"; cx: number; cy: number; rx: number; ry: number }
  | { tipo: "rect"; x: number; y: number; ancho: number; alto: number; rx: number }
  | { tipo: "poligono"; puntos: Array<[number, number]> };

export type Vista = "frente" | "espalda";

export interface Region {
  musculo: Musculo;
  vista: Vista;
  forma: Forma;
}

export interface PiezaDeSilueta {
  vista: Vista;
  forma: Forma;
}

/** Eje de simetría de cada figura. */
const EJE: Readonly<Record<Vista, number>> = { frente: 60, espalda: 200 };

function espejo(forma: Forma, eje: number): Forma {
  switch (forma.tipo) {
    case "elipse":
      return { ...forma, cx: 2 * eje - forma.cx };
    case "rect":
      return { ...forma, x: 2 * eje - (forma.x + forma.ancho) };
    case "poligono":
      return { tipo: "poligono", puntos: forma.puntos.map(([x, y]) => [2 * eje - x, y] as [number, number]) };
  }
}

const elipse = (cx: number, cy: number, rx: number, ry: number): Forma => ({ tipo: "elipse", cx, cy, rx, ry });
const rect = (x: number, y: number, ancho: number, alto: number, rx: number): Forma => ({
  tipo: "rect",
  x,
  y,
  ancho,
  alto,
  rx,
});

/** Una zona par: la forma y su espejo. */
const par = (musculo: Musculo, vista: Vista, forma: Forma): Region[] => [
  { musculo, vista, forma },
  { musculo, vista, forma: espejo(forma, EJE[vista]) },
];

const sola = (musculo: Musculo, vista: Vista, forma: Forma): Region[] => [{ musculo, vista, forma }];

/** Las zonas de cada músculo, en las dos vistas. */
export const REGIONES: readonly Region[] = [
  // ---- De frente ----
  ...sola("trapecios", "frente", {
    tipo: "poligono",
    puntos: [[52, 30], [60, 38], [68, 30], [78, 40], [60, 45], [42, 40]],
  }),
  ...par("deltoides", "frente", elipse(32, 50, 9, 9)),
  ...par("pecho", "frente", elipse(48, 62, 12, 9)),
  ...par("serrato", "frente", elipse(40, 82, 4.5, 8)),
  ...sola("abdominales", "frente", rect(51, 74, 18, 38, 5)),
  ...par("oblicuos", "frente", elipse(45, 100, 4.5, 12)),
  ...par("biceps", "frente", elipse(22, 64, 6, 13)),
  ...par("antebrazos", "frente", elipse(15, 106, 5.5, 19)),
  ...par("flexores-de-cadera", "frente", elipse(47, 126, 7, 6)),
  ...par("aductores", "frente", elipse(55, 160, 3.8, 22)),
  ...par("cuadriceps", "frente", elipse(45, 160, 9, 26)),
  ...par("tibial", "frente", elipse(47, 226, 5.5, 24)),
  // ---- De espalda ----
  ...sola("trapecios", "espalda", {
    tipo: "poligono",
    puntos: [[200, 32], [212, 38], [218, 52], [200, 76], [182, 52], [188, 38]],
  }),
  ...par("deltoides", "espalda", elipse(172, 50, 9, 9)),
  ...par("espalda-alta", "espalda", elipse(188, 76, 11, 17)),
  ...par("triceps", "espalda", elipse(162, 64, 6, 13)),
  ...par("antebrazos", "espalda", elipse(155, 106, 5.5, 19)),
  ...sola("zona-lumbar", "espalda", rect(190, 98, 20, 18, 5)),
  ...par("gluteos", "espalda", elipse(189, 132, 11, 10)),
  ...par("isquiotibiales", "espalda", elipse(185, 166, 9, 24)),
  ...par("gemelos", "espalda", elipse(187, 226, 6.5, 22)),
];

/** El cuerpo de fondo, igual en las dos vistas (la espalda es el frente corrido a la derecha). */
function silueta(vista: Vista): PiezaDeSilueta[] {
  const dx = vista === "frente" ? 0 : 140;
  const formas: Forma[] = [
    elipse(60 + dx, 16, 13, 13), // cabeza
    rect(54 + dx, 28, 12, 10, 3), // cuello
    rect(34 + dx, 38, 52, 86, 14), // torso
    rect(14 + dx, 42, 16, 44, 8), // brazo izquierdo
    rect(90 + dx, 42, 16, 44, 8), // brazo derecho
    rect(8 + dx, 84, 14, 50, 7), // antebrazo izquierdo
    rect(98 + dx, 84, 14, 50, 7), // antebrazo derecho
    rect(38 + dx, 118, 44, 20, 8), // cadera
    rect(36 + dx, 132, 22, 66, 10), // muslo izquierdo
    rect(62 + dx, 132, 22, 66, 10), // muslo derecho
    rect(38 + dx, 196, 18, 64, 8), // pierna izquierda
    rect(64 + dx, 196, 18, 64, 8), // pierna derecha
  ];
  return formas.map((forma) => ({ vista, forma }));
}

export const SILUETA: readonly PiezaDeSilueta[] = [...silueta("frente"), ...silueta("espalda")];

/** Color de cada nivel de intensidad: de 0 (sin trabajar, gris) a 5 (lo más trabajado). */
export const COLORES_POR_NIVEL = ["#E4E4E7", "#FED7AA", "#FDBA74", "#FB923C", "#F97316", "#C2410C"] as const;

/** "1 serie", "8 series", "3,6 series": con coma decimal y el plural que corresponde. */
export function textoDeSeries(series: number): string {
  const numero = Number(series.toFixed(1)).toString().replace(".", ",");
  return `${numero} ${series === 1 ? "serie" : "series"}`;
}
