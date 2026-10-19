/**
 * Peso corporal con meta (T-048, D-65). Funciones puras: sin Prisma ni React.
 *
 * La meta recuerda el peso desde el que se fijó: sin él no se sabe si el objetivo era bajar o
 * subir, y pasarse de la meta por el lado correcto se mostraría como "te faltan X kg" al revés.
 */
import {
  PESO_MAX_KG,
  PESO_MIN_KG,
  progresoHaciaMeta,
  puntosDelGrafico,
  validarPeso,
  variacionDelPeso,
} from "./peso-corporal";

describe("validarPeso", () => {
  it("acepta un peso razonable y lo deja con dos decimales como máximo", () => {
    expect(validarPeso(78.4)).toBe(78.4);
    expect(validarPeso(78)).toBe(78);
    expect(validarPeso(78.456)).toBe(78.46);
  });

  it(`acepta los extremos ${PESO_MIN_KG} y ${PESO_MAX_KG} kg`, () => {
    expect(validarPeso(PESO_MIN_KG)).toBe(PESO_MIN_KG);
    expect(validarPeso(PESO_MAX_KG)).toBe(PESO_MAX_KG);
  });

  it.each([[19.9], [400.1], [0], [-70], [784]])("rechaza %p por estar fuera de rango", (valor) => {
    expect(() => validarPeso(valor)).toThrow(/VALIDATION_ERROR: .*entre 20 y 400 kg/);
  });

  it.each([["78.4"], [null], [undefined], [NaN], [Infinity], [{}]])(
    "rechaza %p: tiene que ser un número",
    (valor) => {
      expect(() => validarPeso(valor)).toThrow(/VALIDATION_ERROR: .*número/);
    }
  );

  it("nombra el campo que falló", () => {
    expect(() => validarPeso("x", "La meta")).toThrow(/La meta tiene que ser un número/);
  });
});

describe("progresoHaciaMeta", () => {
  it("si la meta era bajar, faltan los kilos que sobran", () => {
    expect(progresoHaciaMeta({ actual: 78.4, objetivo: 77, inicial: 82.5 })).toEqual({
      direccion: "bajar",
      faltan: 1.4,
      alcanzada: false,
    });
  });

  it("si la meta era subir, faltan los kilos que faltan", () => {
    expect(progresoHaciaMeta({ actual: 66, objetivo: 70, inicial: 64 })).toEqual({
      direccion: "subir",
      faltan: 4,
      alcanzada: false,
    });
  });

  it("llegar a la meta o pasarse por el lado correcto es alcanzarla", () => {
    expect(progresoHaciaMeta({ actual: 77, objetivo: 77, inicial: 82.5 })).toMatchObject({
      alcanzada: true,
      faltan: 0,
    });
    // Quería bajar a 77 y llegó a 76,5: la meta está cumplida, no "faltan 0,5 para subir".
    expect(progresoHaciaMeta({ actual: 76.5, objetivo: 77, inicial: 82.5 })).toMatchObject({
      direccion: "bajar",
      alcanzada: true,
      faltan: 0,
    });
    expect(progresoHaciaMeta({ actual: 71, objetivo: 70, inicial: 64 })).toMatchObject({
      direccion: "subir",
      alcanzada: true,
    });
  });

  it("no arrastra el ruido de la coma flotante", () => {
    expect(progresoHaciaMeta({ actual: 78.4, objetivo: 77, inicial: 80 }).faltan).toBe(1.4);
  });

  describe("mantener el peso (meta igual al peso de partida)", () => {
    it("dentro de medio kilo está cumplida", () => {
      expect(progresoHaciaMeta({ actual: 70.4, objetivo: 70, inicial: 70 })).toEqual({
        direccion: "mantener",
        faltan: 0.4,
        alcanzada: true,
      });
    });

    it("más lejos de medio kilo no lo está y dice cuánto se alejó", () => {
      expect(progresoHaciaMeta({ actual: 72, objetivo: 70, inicial: 70 })).toEqual({
        direccion: "mantener",
        faltan: 2,
        alcanzada: false,
      });
    });
  });
});

describe("puntosDelGrafico", () => {
  const p = (fecha: string, peso: number) => ({ fecha: new Date(fecha), peso });

  it("ordena de la más antigua a la más reciente", () => {
    const r = puntosDelGrafico([p("2026-10-10T12:00:00Z", 79), p("2026-10-01T12:00:00Z", 80)]);
    expect(r.map((x) => x.peso)).toEqual([80, 79]);
  });

  it("si hay varios pesajes el mismo día, queda el último de ese día", () => {
    const r = puntosDelGrafico([
      p("2026-10-10T11:00:00Z", 79.4), // 08:00 en Argentina
      p("2026-10-10T20:00:00Z", 78.9), // 17:00, mismo día del gimnasio
      p("2026-10-09T12:00:00Z", 80),
    ]);
    expect(r.map((x) => x.peso)).toEqual([80, 78.9]);
  });

  it("el día se cuenta en hora del gimnasio, no en UTC", () => {
    // 02:00 UTC del 11 es todavía el 10 a la noche en Argentina: mismo día que las 15:00 UTC del 10.
    const r = puntosDelGrafico([p("2026-10-10T15:00:00Z", 79), p("2026-10-11T02:00:00Z", 78.8)]);
    expect(r).toHaveLength(1);
    expect(r[0].peso).toBe(78.8);
  });

  it("se queda con los últimos puntos si hay demasiados", () => {
    const muchos = Array.from({ length: 10 }, (_, i) => p(`2026-09-${String(i + 1).padStart(2, "0")}T12:00:00Z`, 80 - i));
    const r = puntosDelGrafico(muchos, 4);
    expect(r.map((x) => x.peso)).toEqual([74, 73, 72, 71]);
  });

  it("sin mediciones devuelve vacío", () => {
    expect(puntosDelGrafico([])).toEqual([]);
  });
});

describe("variacionDelPeso", () => {
  const punto = (peso: number, dia: number) => ({ fecha: new Date(Date.UTC(2026, 9, dia, 12)), peso });

  it("es la diferencia entre el último pesaje y el anterior", () => {
    expect(variacionDelPeso([punto(78.9, 1), punto(78.4, 8)])).toBe(-0.5);
    expect(variacionDelPeso([punto(70, 1), punto(70.6, 8)])).toBe(0.6);
  });

  it("no arrastra el ruido de la coma flotante", () => {
    expect(variacionDelPeso([punto(78.9, 1), punto(78.4, 8)])).toBe(-0.5);
    expect(variacionDelPeso([punto(0.3, 1), punto(0.1, 8)])).toBe(-0.2);
  });

  it("con un solo pesaje o ninguno no hay variación", () => {
    expect(variacionDelPeso([punto(78, 1)])).toBeNull();
    expect(variacionDelPeso([])).toBeNull();
  });
});
