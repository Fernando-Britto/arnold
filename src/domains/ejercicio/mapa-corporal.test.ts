/**
 * Geometría del mapa corporal (T-051 parte 2, D-107): las zonas de cada músculo en la vista de frente y
 * de espalda. Datos puros: sin mocks.
 */
import { ANCHO_MAPA, ALTO_MAPA, COLORES_POR_NIVEL, REGIONES, SILUETA, textoDeSeries, type Forma } from "./mapa-corporal";
import { MUSCULOS } from "./musculos";

/** Todos los puntos extremos de una forma, para comprobar que entra en el dibujo. */
function extremos(f: Forma): Array<[number, number]> {
  if (f.tipo === "elipse") return [[f.cx - f.rx, f.cy - f.ry], [f.cx + f.rx, f.cy + f.ry]];
  if (f.tipo === "rect") return [[f.x, f.y], [f.x + f.ancho, f.y + f.alto]];
  return f.puntos;
}

describe("REGIONES", () => {
  it("cada uno de los 18 músculos se dibuja en alguna vista", () => {
    const dibujados = new Set(REGIONES.map((r) => r.musculo));

    expect([...dibujados].sort()).toEqual([...MUSCULOS].sort());
  });

  it("hay dos vistas, frente y espalda, y cada una tiene sus músculos", () => {
    const frente = REGIONES.filter((r) => r.vista === "frente").map((r) => r.musculo);
    const espalda = REGIONES.filter((r) => r.vista === "espalda").map((r) => r.musculo);

    expect(frente).toEqual(expect.arrayContaining(["pecho", "abdominales", "cuadriceps", "biceps", "tibial"]));
    expect(espalda).toEqual(expect.arrayContaining(["espalda-alta", "gluteos", "isquiotibiales", "triceps", "gemelos"]));
    // Lo que se ve de un solo lado no se dibuja del otro.
    expect(frente).not.toContain("gluteos");
    expect(espalda).not.toContain("pecho");
  });

  it("los músculos pares (izquierdo y derecho) se dibujan los dos, espejados", () => {
    for (const musculo of ["pecho", "biceps", "cuadriceps", "gemelos"] as const) {
      const formas = REGIONES.filter((r) => r.musculo === musculo).map((r) => r.forma);
      expect(formas.length % 2).toBe(0);
    }
  });

  it("todo cabe en el dibujo y no hay números inválidos", () => {
    for (const { forma } of [...REGIONES, ...SILUETA]) {
      for (const [x, y] of extremos(forma)) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(ANCHO_MAPA);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(ALTO_MAPA);
      }
    }
  });

  it("el frente está en la mitad izquierda y la espalda en la derecha, sin mezclarse", () => {
    const mitad = ANCHO_MAPA / 2;
    for (const { vista, forma } of REGIONES) {
      for (const [x] of extremos(forma)) {
        if (vista === "frente") expect(x).toBeLessThan(mitad);
        else expect(x).toBeGreaterThan(mitad);
      }
    }
  });

  it("las formas son válidas: radios y medidas positivos y polígonos de al menos 3 puntos", () => {
    for (const { forma } of [...REGIONES, ...SILUETA]) {
      if (forma.tipo === "elipse") {
        expect(forma.rx).toBeGreaterThan(0);
        expect(forma.ry).toBeGreaterThan(0);
      } else if (forma.tipo === "rect") {
        expect(forma.ancho).toBeGreaterThan(0);
        expect(forma.alto).toBeGreaterThan(0);
      } else {
        expect(forma.puntos.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("SILUETA", () => {
  it("dibuja un cuerpo en cada vista", () => {
    expect(SILUETA.filter((s) => s.vista === "frente").length).toBeGreaterThan(5);
    expect(SILUETA.filter((s) => s.vista === "espalda").length).toBe(SILUETA.filter((s) => s.vista === "frente").length);
  });
});

describe("COLORES_POR_NIVEL", () => {
  it("hay un color por nivel, de 0 a 5, todos distintos", () => {
    expect(COLORES_POR_NIVEL).toHaveLength(6);
    expect(new Set(COLORES_POR_NIVEL).size).toBe(6);
    for (const c of COLORES_POR_NIVEL) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("textoDeSeries", () => {
  it.each([
    [1, "1 serie"],
    [8, "8 series"],
    [3.6, "3,6 series"],
    [0.4, "0,4 series"],
    [12, "12 series"],
  ])("%d → %s", (n, texto) => {
    expect(textoDeSeries(n)).toBe(texto);
  });
});
