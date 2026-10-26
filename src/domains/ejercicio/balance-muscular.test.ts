/**
 * Balance muscular (T-051 parte 2, D-107): períodos, y el volumen por músculo ordenado y normalizado
 * para dibujarlo. Funciones puras: sin mocks.
 */
import {
  armarBalance,
  desdeDelPeriodo,
  esPeriodo,
  ETIQUETAS_PERIODO,
  nivelDeIntensidad,
  PERIODOS,
} from "./balance-muscular";

describe("periodos", () => {
  it("son cuatro, de menos a más", () => {
    expect(PERIODOS).toEqual(["semana", "30d", "90d", "todo"]);
    for (const p of PERIODOS) expect(ETIQUETAS_PERIODO[p]).toBeTruthy();
  });

  it("esPeriodo acepta solo esos valores", () => {
    expect(esPeriodo("semana")).toBe(true);
    expect(esPeriodo("todo")).toBe(true);
    expect(esPeriodo("año")).toBe(false);
    expect(esPeriodo("")).toBe(false);
    expect(esPeriodo(null)).toBe(false);
    expect(esPeriodo(7)).toBe(false);
  });
});

describe("desdeDelPeriodo", () => {
  // Jueves 15/10/2026 14:00 en Argentina (17:00Z).
  const ahora = new Date("2026-10-15T17:00:00.000Z");
  const inicioDeHoy = new Date("2026-10-15T03:00:00.000Z"); // 00:00 en UTC-3

  it("una semana son los últimos 7 días contando hoy: empieza al inicio del día de hace 6 días", () => {
    expect(desdeDelPeriodo("semana", ahora)).toEqual(new Date("2026-10-09T03:00:00.000Z"));
  });

  it("30 y 90 días cuentan hoy como el primero", () => {
    expect(desdeDelPeriodo("30d", ahora)).toEqual(new Date(inicioDeHoy.getTime() - 29 * 86_400_000));
    expect(desdeDelPeriodo("90d", ahora)).toEqual(new Date(inicioDeHoy.getTime() - 89 * 86_400_000));
  });

  it("'todo' no tiene fecha de inicio", () => {
    expect(desdeDelPeriodo("todo", ahora)).toBeNull();
  });

  it("el día se cuenta en hora del gimnasio: a las 01:00Z todavía es el día anterior en Argentina", () => {
    const madrugada = new Date("2026-10-16T01:00:00.000Z"); // 22:00 del 15/10 en Argentina

    expect(desdeDelPeriodo("semana", madrugada)).toEqual(new Date("2026-10-09T03:00:00.000Z"));
  });
});

describe("nivelDeIntensidad", () => {
  it.each([
    [0, 0],
    [0.001, 1],
    [0.2, 1],
    [0.21, 2],
    [0.4, 2],
    [0.5, 3],
    [0.8, 4],
    [0.81, 5],
    [1, 5],
  ])("%d → nivel %d", (intensidad, nivel) => {
    expect(nivelDeIntensidad(intensidad)).toBe(nivel);
  });

  it("valores fuera de rango o inválidos no se salen de la escala", () => {
    expect(nivelDeIntensidad(-1)).toBe(0);
    expect(nivelDeIntensidad(2)).toBe(5);
    expect(nivelDeIntensidad(Number.NaN)).toBe(0);
  });
});

describe("armarBalance", () => {
  const base = { periodo: "semana" as const, desde: new Date("2026-10-09T03:00:00.000Z"), totalSeries: 14 };

  it("ordena los músculos de más a menos series y los redondea a un decimal", () => {
    const b = armarBalance({ pecho: 8, triceps: 3.2000000000000006, deltoides: 3.6 }, base);

    expect(b.musculos.map((m) => [m.musculo, m.series])).toEqual([
      ["pecho", 8],
      ["deltoides", 3.6],
      ["triceps", 3.2],
    ]);
  });

  it("la intensidad es relativa al músculo más trabajado (que vale 1)", () => {
    const b = armarBalance({ pecho: 8, triceps: 4, deltoides: 2 }, base);

    expect(b.musculos.map((m) => m.intensidad)).toEqual([1, 0.5, 0.25]);
  });

  it("cada músculo lleva su nombre en español", () => {
    const b = armarBalance({ biceps: 4, "zona-lumbar": 2 }, base);

    expect(b.musculos.map((m) => m.etiqueta)).toEqual(["Bíceps", "Zona lumbar"]);
  });

  it("con el mismo volumen se mantiene el orden del cuerpo, de la cabeza a los pies", () => {
    const b = armarBalance({ gemelos: 3, pecho: 3, trapecios: 3 }, base);

    expect(b.musculos.map((m) => m.musculo)).toEqual(["trapecios", "pecho", "gemelos"]);
  });

  it("lista aparte los músculos que no se trabajaron en el período", () => {
    const b = armarBalance({ pecho: 8 }, base);

    expect(b.sinTrabajar).not.toContain("pecho");
    expect(b.sinTrabajar).toHaveLength(17);
    expect(b.sinTrabajar[0]).toBe("trapecios");
  });

  it("sin volumen: nada trabajado, todo sin trabajar y sin dividir por cero", () => {
    const b = armarBalance({}, { ...base, totalSeries: 0 });

    expect(b.musculos).toEqual([]);
    expect(b.sinTrabajar).toHaveLength(18);
    expect(b.totalSeries).toBe(0);
  });

  it("conserva el período, el inicio y el total de series (reales, no ponderadas)", () => {
    const b = armarBalance({ pecho: 8, triceps: 3.2 }, base);

    expect(b.periodo).toBe("semana");
    expect(b.desde).toEqual(base.desde);
    expect(b.totalSeries).toBe(14);
  });

  it("un volumen cero o negativo no cuenta como trabajado", () => {
    const b = armarBalance({ pecho: 0, biceps: -2, triceps: 4 }, base);

    expect(b.musculos.map((m) => m.musculo)).toEqual(["triceps"]);
    expect(b.sinTrabajar).toContain("pecho");
  });
});
