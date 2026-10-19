/**
 * Presentación del peso corporal (T-048 parte 2, D-66): texto, lectura de lo que escribe el socio
 * y geometría del gráfico. Funciones puras: sin mocks.
 */
import {
  describirMeta,
  describirVariacion,
  etiquetaDeFecha,
  formatearPesoKg,
  geometriaDelGrafico,
  parsearPesoIngresado,
} from "./presentacion-peso";

describe("parsearPesoIngresado", () => {
  it.each([
    ["78,4", 78.4],
    ["78.4", 78.4],
    ["  80 ", 80],
    ["78,45", 78.45],
    ["100", 100],
  ])("%j → %d", (texto, esperado) => {
    expect(parsearPesoIngresado(texto)).toBe(esperado);
  });

  it.each([[""], ["   "], ["abc"], ["78,4,5"], ["78 kg"], ["-"], ["1e2"], ["78,"], [",5"]])(
    "%j no es un peso",
    (texto) => {
      expect(parsearPesoIngresado(texto)).toBeNull();
    }
  );

  it("un número fuera de rango igual se lee: del rango se ocupa la validación", () => {
    expect(parsearPesoIngresado("784")).toBe(784);
  });
});

describe("formatearPesoKg", () => {
  it("coma decimal y sin ceros de sobra", () => {
    expect(formatearPesoKg(78.4)).toBe("78,4 kg");
    expect(formatearPesoKg(80)).toBe("80 kg");
    expect(formatearPesoKg(78.45)).toBe("78,45 kg");
    expect(formatearPesoKg(1.4)).toBe("1,4 kg");
  });

  it("limpia el ruido de la coma flotante", () => {
    expect(formatearPesoKg(78.4 - 77)).toBe("1,4 kg");
  });
});

describe("describirMeta", () => {
  it("bajar y todavía no llegó: cuánto falta", () => {
    expect(describirMeta({ direccion: "bajar", faltan: 1.4, alcanzada: false }, 77)).toBe(
      "Meta 77 kg · te faltan 1,4 kg"
    );
  });

  it("subir y todavía no llegó: cuánto falta", () => {
    expect(describirMeta({ direccion: "subir", faltan: 2, alcanzada: false }, 82)).toBe(
      "Meta 82 kg · te faltan 2 kg"
    );
  });

  it("alcanzada (también pasándose por el lado correcto) no dice 'te faltan'", () => {
    const texto = describirMeta({ direccion: "bajar", faltan: 0, alcanzada: true }, 77);

    expect(texto).toBe("Meta 77 kg · ¡alcanzada!");
    expect(texto).not.toMatch(/faltan/);
  });

  it("mantener dentro del margen", () => {
    expect(describirMeta({ direccion: "mantener", faltan: 0.3, alcanzada: true }, 77)).toBe(
      "Meta: mantener 77 kg · estás dentro del margen"
    );
  });

  it("mantener y se alejó: cuánto se alejó", () => {
    expect(describirMeta({ direccion: "mantener", faltan: 1.2, alcanzada: false }, 77)).toBe(
      "Meta: mantener 77 kg · estás a 1,2 kg"
    );
  });
});

describe("describirVariacion", () => {
  it("sin dos pesajes no hay variación", () => {
    expect(describirVariacion(null)).toBeNull();
  });

  it("dice en palabras si bajó, subió o quedó igual (no solo con un signo o un color)", () => {
    expect(describirVariacion(-0.5)).toEqual({ texto: "bajó 0,5 kg", sentido: "baja" });
    expect(describirVariacion(1.25)).toEqual({ texto: "subió 1,25 kg", sentido: "sube" });
    expect(describirVariacion(0)).toEqual({ texto: "igual que el pesaje anterior", sentido: "igual" });
  });
});

describe("etiquetaDeFecha", () => {
  it("día y mes cortos en hora del gimnasio, sin depender del ICU del equipo", () => {
    expect(etiquetaDeFecha(new Date("2026-09-12T15:00:00.000Z"))).toBe("12 sep");
    expect(etiquetaDeFecha(new Date("2026-01-05T15:00:00.000Z"))).toBe("5 ene");
  });

  it("las 01:00Z son del día anterior en Argentina (UTC-3)", () => {
    expect(etiquetaDeFecha(new Date("2026-10-01T01:00:00.000Z"))).toBe("30 sep");
  });
});

describe("geometriaDelGrafico", () => {
  const punto = (iso: string, peso: number) => ({ fecha: new Date(iso), peso });
  const puntos = [
    punto("2026-09-01T15:00:00.000Z", 82),
    punto("2026-09-15T15:00:00.000Z", 80),
    punto("2026-10-01T15:00:00.000Z", 78.4),
  ];

  it("sin pesajes no hay nada que dibujar", () => {
    expect(geometriaDelGrafico([], null)).toBeNull();
  });

  it("los puntos van de izquierda a derecha según la fecha, y el más pesado queda más arriba", () => {
    const g = geometriaDelGrafico(puntos, null)!;

    expect(g.puntos).toHaveLength(3);
    expect(g.puntos[0].x).toBeLessThan(g.puntos[1].x);
    expect(g.puntos[1].x).toBeLessThan(g.puntos[2].x);
    // y crece hacia abajo: 82 kg (el mayor) tiene la y más chica.
    expect(g.puntos[0].y).toBeLessThan(g.puntos[2].y);
  });

  it("el eje de tiempo es proporcional: 14 días y 16 días no se dibujan a la misma distancia", () => {
    const g = geometriaDelGrafico(puntos, null)!;

    const primero = g.puntos[1].x - g.puntos[0].x;
    const segundo = g.puntos[2].x - g.puntos[1].x;
    expect(segundo / primero).toBeCloseTo(16 / 14, 2);
  });

  it("la ruta empieza con M y une todos los puntos con L", () => {
    const g = geometriaDelGrafico(puntos, null)!;

    expect(g.ruta.startsWith("M")).toBe(true);
    expect(g.ruta.match(/L/g)).toHaveLength(2);
  });

  it("todo cae dentro del área dibujable", () => {
    const g = geometriaDelGrafico(puntos, 70)!;

    for (const p of g.puntos) {
      expect(p.x).toBeGreaterThanOrEqual(g.area.izquierda);
      expect(p.x).toBeLessThanOrEqual(g.area.derecha);
      expect(p.y).toBeGreaterThanOrEqual(g.area.arriba);
      expect(p.y).toBeLessThanOrEqual(g.area.abajo);
    }
  });

  it("la meta entra en la escala aunque esté lejos de los pesajes, y queda por debajo si es más baja", () => {
    const sinMeta = geometriaDelGrafico(puntos, null)!;
    const conMeta = geometriaDelGrafico(puntos, 70)!;

    expect(sinMeta.metaY).toBeNull();
    expect(conMeta.metaY).not.toBeNull();
    expect(conMeta.metaY!).toBeGreaterThan(Math.max(...conMeta.puntos.map((p) => p.y)));
    expect(conMeta.metaY!).toBeLessThanOrEqual(conMeta.area.abajo);
  });

  it("un solo pesaje queda centrado y no divide por cero", () => {
    const g = geometriaDelGrafico([punto("2026-10-01T15:00:00.000Z", 78.4)], 77)!;

    expect(g.puntos).toHaveLength(1);
    expect(Number.isFinite(g.puntos[0].x)).toBe(true);
    expect(Number.isFinite(g.puntos[0].y)).toBe(true);
    expect(g.puntos[0].x).toBeCloseTo((g.area.izquierda + g.area.derecha) / 2, 5);
    expect(g.ruta).toBe("");
  });

  it("pesos casi iguales no aplastan el gráfico: la escala tiene al menos 1 kg de alto", () => {
    const g = geometriaDelGrafico(
      [punto("2026-09-01T15:00:00.000Z", 78), punto("2026-09-02T15:00:00.000Z", 78)],
      null
    )!;

    expect(Number.isFinite(g.puntos[0].y)).toBe(true);
    expect(g.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("las marcas del eje de pesos son números 'redondos' y están ordenadas de arriba hacia abajo", () => {
    const g = geometriaDelGrafico(puntos, 77)!;

    expect(g.ticks.length).toBeGreaterThanOrEqual(2);
    for (const t of g.ticks) expect(Number.isInteger(t.valor * 2)).toBe(true);
    const ys = g.ticks.map((t) => t.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(g.ticks[0].valor).toBeGreaterThan(g.ticks[g.ticks.length - 1].valor);
  });

  it("rotula el primer y el último día", () => {
    const g = geometriaDelGrafico(puntos, null)!;

    expect(g.etiquetasX.map((e) => e.texto)).toEqual(["1 sep", "1 oct"]);
  });

  it("un solo pesaje rotula un solo día", () => {
    const g = geometriaDelGrafico([punto("2026-10-01T15:00:00.000Z", 78.4)], null)!;

    expect(g.etiquetasX.map((e) => e.texto)).toEqual(["1 oct"]);
  });
});
