/**
 * Resumen al terminar la sesión (T-046b, D-62). Funciones puras: sin Prisma ni React.
 *
 * Por ejercicio: lo de hoy contra la última vez (↑ ↓ =) y la carga que se va a sugerir en la
 * próxima sesión, que sale de la MISMA función que arma esa sesión (`sugerirProximaCarga`).
 */
import { compararConUltimaVez, resumirEjercicio } from "./resumen-sesion";
import type { RegistroHistorico } from "./historial-ejercicio";

type Serie = { carga: number; repeticiones: number; rir: number | null };
const s = (carga: number, repeticiones: number): Serie => ({ carga, repeticiones, rir: 2 });

describe("compararConUltimaVez", () => {
  it("sin sesión anterior es la primera vez", () => {
    expect(compararConUltimaVez([s(40, 10)], null)).toBe("primera");
    expect(compararConUltimaVez([s(40, 10)], [])).toBe("primera");
  });

  it("sube si la carga de trabajo es mayor, aunque haya menos repeticiones", () => {
    expect(compararConUltimaVez([s(42.5, 8), s(42.5, 8)], [s(40, 10), s(40, 10)])).toBe("subio");
  });

  it("baja si la carga de trabajo es menor", () => {
    expect(compararConUltimaVez([s(37.5, 12)], [s(40, 10)])).toBe("bajo");
  });

  it("con la misma carga decide el total de repeticiones", () => {
    expect(compararConUltimaVez([s(40, 10), s(40, 10)], [s(40, 10), s(40, 8)])).toBe("subio");
    expect(compararConUltimaVez([s(40, 10), s(40, 6)], [s(40, 10), s(40, 8)])).toBe("bajo");
    expect(compararConUltimaVez([s(40, 10), s(40, 8)], [s(40, 9), s(40, 9)])).toBe("igual");
  });

  it("sin carga (peso corporal) compara las repeticiones", () => {
    expect(compararConUltimaVez([s(0, 12)], [s(0, 10)])).toBe("subio");
  });

  it("la carga de trabajo es la mayor de las series, no la última", () => {
    // Si se mirara la última serie (35 contra 40) daría "bajó"; con la mayor (40 y 40) es igual.
    expect(compararConUltimaVez([s(40, 10), s(35, 10)], [s(40, 10), s(40, 10)])).toBe("igual");
  });
});

describe("compararConUltimaVez con drop sets (T-047, D-64)", () => {
  const drop = (carga: number, repeticiones: number) => ({
    carga,
    repeticiones,
    rir: 0,
    tipo: "DROP_SET" as const,
  });

  it("las repeticiones de un drop set no hacen 'subir' una sesión que rindió igual", () => {
    // Mismo trabajo (2 × 10 a 40 kg); hoy se sumó un drop set con 15 repeticiones.
    const hoy = [s(40, 10), s(40, 10), drop(30, 15)];

    expect(compararConUltimaVez(hoy, [s(40, 10), s(40, 10)])).toBe("igual");
  });

  it("tampoco hace 'bajar': un drop set de la última vez no cuenta contra hoy", () => {
    const antes = [s(40, 10), s(40, 10), drop(30, 15)];

    expect(compararConUltimaVez([s(40, 10), s(40, 10)], antes)).toBe("igual");
  });

  it("la carga de trabajo no la marca el drop set aunque tenga más peso registrado", () => {
    expect(compararConUltimaVez([s(40, 10), drop(60, 3)], [s(40, 10)])).toBe("igual");
  });

  it("si lo único que hubo fueron drop sets, se compara con ellos (no queda vacío)", () => {
    expect(compararConUltimaVez([drop(30, 12)], [drop(30, 10)])).toBe("subio");
  });
});

describe("resumirEjercicio", () => {
  const PRESCRIPCION = { series: 2, repeticiones: 10 };
  const base = { ejercicioId: "ej-1", nombre: "Press banca", prescripcion: PRESCRIPCION, incrementoKg: 2.5 };

  function reg(sesionId: string, numeroSerie: number, carga: number, repeticiones: number, dia: number): RegistroHistorico {
    return {
      carga,
      repeticiones,
      rir: 2,
      numeroSerie,
      fecha: new Date(Date.UTC(2026, 9, dia, 15, numeroSerie)),
      sesionId,
    };
  }
  /** Sesión completa de 2 series iguales. */
  const sesion = (id: string, carga: number, reps: number, dia: number) => [
    reg(id, 1, carga, reps, dia),
    reg(id, 2, carga, reps, dia),
  ];

  it("devuelve null si hoy no hizo el ejercicio", () => {
    const r = resumirEjercicio({ ...base, registros: sesion("s-vieja", 40, 10, 1), sesionId: "s-hoy" });
    expect(r).toBeNull();
  });

  it("arma lo de hoy, la última vez, la tendencia y la próxima carga", () => {
    const r = resumirEjercicio({
      ...base,
      registros: [...sesion("s-hoy", 42.5, 10, 8), ...sesion("s-1", 40, 10, 1)],
      sesionId: "s-hoy",
    });

    expect(r?.hoy).toEqual([s(42.5, 10), s(42.5, 10)]);
    expect(r?.ultimaVez?.series).toEqual([s(40, 10), s(40, 10)]);
    expect(r?.tendencia).toBe("subio");
    // Hoy cumplió todo: la próxima sesión arranca 2,5 kg más arriba.
    expect(r?.proxima).toMatchObject({ tipo: "subir", carga: 45 });
  });

  it("ordena las series de hoy por número de serie", () => {
    const r = resumirEjercicio({
      ...base,
      registros: [reg("s-hoy", 2, 42.5, 10, 8), reg("s-hoy", 1, 40, 10, 8)],
      sesionId: "s-hoy",
    });

    expect(r?.hoy.map((x) => x.carga)).toEqual([40, 42.5]);
  });

  it("la primera vez no tiene última vez, pero igual sugiere desde lo de hoy", () => {
    const r = resumirEjercicio({ ...base, registros: sesion("s-hoy", 40, 10, 8), sesionId: "s-hoy" });

    expect(r?.ultimaVez).toBeNull();
    expect(r?.tendencia).toBe("primera");
    expect(r?.proxima).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("cuenta la sesión de hoy: si es el tercer fallo seguido, ya anticipa la descarga", () => {
    const r = resumirEjercicio({
      ...base,
      registros: [
        ...sesion("s-hoy", 40, 7, 15),
        ...sesion("s-2", 40, 7, 8),
        ...sesion("s-1", 40, 7, 1),
      ],
      sesionId: "s-hoy",
    });

    // Es lo que la próxima sesión va a precargar, no un número distinto.
    expect(r?.proxima).toMatchObject({ tipo: "descargar", carga: 35 });
  });

  it("no juzga las sesiones anteriores al último cambio del plan", () => {
    const r = resumirEjercicio({
      ...base,
      registros: [...sesion("s-hoy", 40, 10, 15), ...sesion("s-1", 40, 6, 1), ...sesion("s-2", 40, 6, 8)],
      sesionId: "s-hoy",
      planDesde: new Date(Date.UTC(2026, 9, 12)),
    });

    expect(r?.proxima).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  describe("marcas nuevas (T-046c, D-63)", () => {
    const hoyPress = () => [...sesion("s-hoy", 42.5, 10, 8)];

    it("sin las series anteriores no anuncia ninguna marca", () => {
      const r = resumirEjercicio({ ...base, registros: hoyPress(), sesionId: "s-hoy" });

      expect(r?.marcas).toEqual({ carga: null, e1rm: null });
    });

    it("compara contra todo el historial anterior que se le pasa", () => {
      const r = resumirEjercicio({
        ...base,
        registros: hoyPress(),
        sesionId: "s-hoy",
        seriesAnteriores: [
          { carga: 40, repeticiones: 10 },
          { carga: 40, repeticiones: 8 },
        ],
      });

      expect(r?.marcas.carga).toEqual({ valor: 42.5, anterior: 40 });
      // 42,5 × 10 → 56,7 → 56,5 contra 40 × 10 → 53,3 → 53,5.
      expect(r?.marcas.e1rm).toEqual({ valor: 56.5, anterior: 53.5 });
    });

    it("si hoy no supera lo anterior, no hay marcas", () => {
      const r = resumirEjercicio({
        ...base,
        registros: hoyPress(),
        sesionId: "s-hoy",
        seriesAnteriores: [{ carga: 50, repeticiones: 10 }],
      });

      expect(r?.marcas).toEqual({ carga: null, e1rm: null });
    });
  });
});
