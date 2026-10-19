/**
 * Marcas personales por ejercicio (T-046c, D-63). Funciones puras: sin Prisma ni React.
 *
 * 1RM estimado con Epley (peso × (1 + reps / 30)), solo hasta TOPE_REPS_1RM repeticiones: más allá
 * la fórmula deja de ser fiable. Una marca es nueva si hoy supera TODO lo anterior.
 */
import {
  TOPE_REPS_1RM,
  avisoDeRecord,
  detectarMarcasNuevas,
  estimar1RM,
  fronteraDeRecords,
  mejoresMarcas,
  recordConCarga,
  redondearMedioKg,
} from "./marcas-ejercicio";

const s = (carga: number, repeticiones: number) => ({ carga, repeticiones });

describe("estimar1RM (Epley)", () => {
  it("aplica peso × (1 + repeticiones / 30)", () => {
    expect(estimar1RM(100, 5)).toBeCloseTo(116.667, 2);
    expect(estimar1RM(60, 10)).toBeCloseTo(80, 5);
  });

  it("con una repetición el 1RM es la propia carga (Epley la inflaría un 3 %)", () => {
    expect(estimar1RM(100, 1)).toBe(100);
  });

  it(`llega hasta ${TOPE_REPS_1RM} repeticiones y no más`, () => {
    expect(estimar1RM(100, TOPE_REPS_1RM)).toBeCloseTo(140, 5);
    expect(estimar1RM(100, TOPE_REPS_1RM + 1)).toBeNull();
  });

  it("sin carga o sin repeticiones válidas no hay estimación", () => {
    expect(estimar1RM(0, 8)).toBeNull();
    expect(estimar1RM(-5, 8)).toBeNull();
    expect(estimar1RM(40, 0)).toBeNull();
  });
});

describe("redondearMedioKg", () => {
  it("redondea al 0,5 kg más cercano para no aparentar una precisión que no existe", () => {
    expect(redondearMedioKg(116.667)).toBe(116.5);
    expect(redondearMedioKg(117.3)).toBe(117.5);
    expect(redondearMedioKg(117.2)).toBe(117);
  });
});

describe("mejoresMarcas", () => {
  it("devuelve la mayor carga y el mayor 1RM estimado", () => {
    // 100×1 → 100; 80×10 → 106,7: el mejor 1RM no sale de la serie más pesada.
    expect(mejoresMarcas([s(100, 1), s(80, 10)])).toEqual({ mejorCarga: 100, mejor1RM: 106.5 });
  });

  it("ignora las series sin carga", () => {
    expect(mejoresMarcas([s(0, 12), s(40, 10)]).mejorCarga).toBe(40);
  });

  it("sin series con carga no hay marcas", () => {
    expect(mejoresMarcas([])).toEqual({ mejorCarga: 0, mejor1RM: null });
    expect(mejoresMarcas([s(0, 12)])).toEqual({ mejorCarga: 0, mejor1RM: null });
  });

  it("una serie por encima del tope cuenta para la carga pero no para el 1RM", () => {
    expect(mejoresMarcas([s(50, 20)])).toEqual({ mejorCarga: 50, mejor1RM: null });
  });
});

describe("detectarMarcasNuevas", () => {
  it("sin historial anterior no hay marcas: lo de hoy es el punto de partida", () => {
    expect(detectarMarcasNuevas([s(40, 10)], [])).toEqual({ carga: null, e1rm: null });
  });

  it("detecta una marca de carga con el valor anterior", () => {
    const r = detectarMarcasNuevas([s(45, 8)], [s(40, 10), s(42.5, 8)]);
    expect(r.carga).toEqual({ valor: 45, anterior: 42.5 });
  });

  it("la misma carga que antes no es marca", () => {
    expect(detectarMarcasNuevas([s(42.5, 8)], [s(42.5, 8)]).carga).toBeNull();
  });

  it("puede haber marca de 1RM sin marca de carga", () => {
    // 40×12 → 56 contra 45×5 → 52,5: más repeticiones con menos peso.
    const r = detectarMarcasNuevas([s(40, 12)], [s(45, 5)]);
    expect(r.carga).toBeNull();
    expect(r.e1rm).toEqual({ valor: 56, anterior: 52.5 });
  });

  it("compara el 1RM ya redondeado: no anuncia '116,5 (antes 116,5)'", () => {
    expect(detectarMarcasNuevas([s(100, 5)], [s(100, 5)]).e1rm).toBeNull();
    expect(detectarMarcasNuevas([s(100, 6)], [s(100, 5)]).e1rm).toEqual({
      valor: 120,
      anterior: 116.5,
    });
  });

  it("una serie sobre el tope de repeticiones da marca de carga pero no de 1RM", () => {
    const r = detectarMarcasNuevas([s(50, 20)], [s(45, 10)]);
    expect(r.carga).toEqual({ valor: 50, anterior: 45 });
    expect(r.e1rm).toBeNull();
  });

  it("si antes solo hubo series sin carga, no hay con qué comparar", () => {
    expect(detectarMarcasNuevas([s(40, 10)], [s(0, 15)])).toEqual({ carga: null, e1rm: null });
  });
});

describe("fronteraDeRecords", () => {
  it("se queda con las series que ninguna otra supera en carga y en repeticiones", () => {
    const f = fronteraDeRecords([s(40, 10), s(40, 12), s(50, 6), s(45, 6), s(50, 4)]);
    // 40×10 pierde contra 40×12; 45×6 contra 50×6; 50×4 contra 50×6.
    expect(f).toEqual([s(40, 12), s(50, 6)]);
  });

  it("una serie repetida no se duplica", () => {
    expect(fronteraDeRecords([s(40, 10), s(40, 10)])).toEqual([s(40, 10)]);
  });

  it("ignora las series sin carga y queda ordenada por carga", () => {
    expect(fronteraDeRecords([s(0, 20), s(60, 3), s(30, 15)])).toEqual([s(30, 15), s(60, 3)]);
  });

  it("sin series devuelve vacío", () => {
    expect(fronteraDeRecords([])).toEqual([]);
  });

  it("devuelve solo carga y repeticiones, aunque la entrada traiga más campos", () => {
    // Lo que sale va al navegador: no tiene que arrastrar el sesionId ni nada de la consulta.
    const entrada = [{ carga: 40, repeticiones: 10, sesionId: "s-1", rir: 2 }];
    expect(fronteraDeRecords(entrada)).toStrictEqual([{ carga: 40, repeticiones: 10 }]);
  });
});

describe("recordConCarga", () => {
  const frontera = fronteraDeRecords([s(40, 12), s(50, 6), s(60, 3)]);

  it("es el mejor número de repeticiones con esa carga o más", () => {
    expect(recordConCarga(frontera, 40)).toEqual(s(40, 12));
    expect(recordConCarga(frontera, 45)).toEqual(s(50, 6));
    expect(recordConCarga(frontera, 55)).toEqual(s(60, 3));
  });

  it("con una carga que nunca se levantó no hay récord", () => {
    expect(recordConCarga(frontera, 62.5)).toBeNull();
  });

  it("con una carga menor a todo lo hecho, manda la serie con más repeticiones", () => {
    expect(recordConCarga(frontera, 20)).toEqual(s(40, 12));
  });

  it("sin historial no hay récord", () => {
    expect(recordConCarga([], 40)).toBeNull();
  });
});

describe("avisoDeRecord (línea de récord en vivo)", () => {
  const frontera = fronteraDeRecords([s(40, 12), s(50, 6), s(60, 3)]);

  it("con una carga ya levantada, muestra el récord a superar", () => {
    expect(avisoDeRecord(frontera, 50)).toEqual({ tipo: "record", record: s(50, 6) });
  });

  it("con una carga más pesada que todo lo levantado, avisa que supera la mejor marca", () => {
    expect(avisoDeRecord(frontera, 62.5)).toEqual({ tipo: "nueva-carga", mejorCarga: 60 });
  });

  it("sin historial no avisa nada: no hay contra qué compararse", () => {
    expect(avisoDeRecord([], 40)).toBeNull();
  });

  it("sin carga elegida no avisa nada", () => {
    expect(avisoDeRecord(frontera, 0)).toBeNull();
  });
});
