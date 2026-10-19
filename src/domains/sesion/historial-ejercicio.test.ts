/**
 * Historial por ejercicio (D-58): "última vez", precarga y formato. Funciones puras: sin mocks.
 */
import {
  agruparSesiones,
  agruparUltimaVez,
  cargaPrecargada,
  describirHace,
  describirSeries,
  formatearSerie,
  type RegistroHistorico,
} from "./historial-ejercicio";

function registro(over: Partial<RegistroHistorico> = {}): RegistroHistorico {
  return {
    carga: 40,
    repeticiones: 10,
    rir: 2,
    numeroSerie: 1,
    fecha: new Date("2026-10-10T13:00:00.000Z"),
    sesionId: "s-pasada",
    ...over,
  };
}

describe("agruparSesiones (D-59)", () => {
  it("devuelve cada sesión por separado, de la más antigua a la más reciente", () => {
    const r = agruparSesiones([
      registro({ sesionId: "s-2", fecha: new Date("2026-10-08T13:00:00.000Z"), carga: 40 }),
      registro({ sesionId: "s-1", fecha: new Date("2026-10-01T13:00:00.000Z"), carga: 30 }),
      registro({ sesionId: "s-3", fecha: new Date("2026-10-15T13:00:00.000Z"), carga: 50 }),
    ]);
    expect(r.map((s) => s.series[0].carga)).toEqual([30, 40, 50]);
  });

  it("junta las series de una misma sesión en el orden en que se hicieron", () => {
    const r = agruparSesiones([
      registro({ numeroSerie: 2, carga: 42 }),
      registro({ numeroSerie: 1, carga: 40 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].series.map((s) => s.carga)).toEqual([40, 42]);
  });

  it("ignora la sesión en curso", () => {
    const r = agruparSesiones(
      [registro({ sesionId: "s-pasada" }), registro({ sesionId: "s-actual" })],
      "s-actual"
    );
    expect(r).toHaveLength(1);
  });

  it("agrupa por día del gimnasio los registros sin sesión", () => {
    const r = agruparSesiones([
      registro({ sesionId: null, fecha: new Date("2026-10-10T13:00:00.000Z") }),
      registro({ sesionId: null, fecha: new Date("2026-10-10T20:00:00.000Z") }),
      registro({ sesionId: null, fecha: new Date("2026-10-12T13:00:00.000Z") }),
    ]);
    expect(r.map((s) => s.series.length)).toEqual([2, 1]);
  });
});

describe("agruparUltimaVez", () => {
  it("devuelve null si nunca hizo el ejercicio", () => {
    expect(agruparUltimaVez([])).toBeNull();
  });

  it("devuelve las series de la sesión más reciente, ordenadas por número de serie", () => {
    const r = agruparUltimaVez([
      registro({ sesionId: "s-vieja", fecha: new Date("2026-10-01T13:00:00.000Z"), carga: 30 }),
      registro({ numeroSerie: 2, carga: 42.5, fecha: new Date("2026-10-10T13:05:00.000Z") }),
      registro({ numeroSerie: 1, carga: 40, fecha: new Date("2026-10-10T13:00:00.000Z") }),
    ]);

    expect(r?.series.map((s) => s.carga)).toEqual([40, 42.5]);
    expect(r?.fecha).toEqual(new Date("2026-10-10T13:05:00.000Z"));
  });

  it("no mezcla series de otras sesiones", () => {
    const r = agruparUltimaVez([
      registro({ sesionId: "s-vieja", carga: 30, fecha: new Date("2026-10-01T13:00:00.000Z") }),
      registro({ carga: 40 }),
    ]);

    expect(r?.series).toEqual([{ carga: 40, repeticiones: 10, rir: 2 }]);
  });

  it("ignora la sesión en curso: la 'última vez' es siempre otra sesión", () => {
    const r = agruparUltimaVez(
      [
        registro({ sesionId: "s-actual", carga: 50, fecha: new Date("2026-10-16T13:00:00.000Z") }),
        registro({ carga: 40 }),
      ],
      "s-actual"
    );

    expect(r?.series.map((s) => s.carga)).toEqual([40]);
  });

  it("devuelve null si lo único que hay es de la sesión en curso", () => {
    expect(agruparUltimaVez([registro({ sesionId: "s-actual" })], "s-actual")).toBeNull();
  });

  it("agrupa por día del gimnasio los registros viejos sin sesión", () => {
    const r = agruparUltimaVez([
      registro({ sesionId: null, numeroSerie: null, carga: 20, fecha: new Date("2026-09-20T13:00:00.000Z") }),
      registro({ sesionId: null, numeroSerie: null, carga: 35, fecha: new Date("2026-10-05T13:00:00.000Z") }),
      registro({ sesionId: null, numeroSerie: null, carga: 37.5, fecha: new Date("2026-10-05T13:10:00.000Z") }),
    ]);

    expect(r?.series.map((s) => s.carga)).toEqual([35, 37.5]);
  });

  it("el día del gimnasio es UTC-3: las 01:00Z son del día anterior", () => {
    // 01:00Z del 06/10 son las 22:00 del 05/10 en Argentina: misma sesión que las 13:00Z del 05/10.
    const r = agruparUltimaVez([
      registro({ sesionId: null, numeroSerie: null, carga: 35, fecha: new Date("2026-10-05T13:00:00.000Z") }),
      registro({ sesionId: null, numeroSerie: null, carga: 36, fecha: new Date("2026-10-06T01:00:00.000Z") }),
    ]);

    expect(r?.series.map((s) => s.carga)).toEqual([35, 36]);
  });
});

describe("cargaPrecargada", () => {
  const ultimaVez = {
    fecha: new Date("2026-10-10T13:00:00.000Z"),
    series: [
      { carga: 40, repeticiones: 10, rir: null },
      { carga: 42.5, repeticiones: 8, rir: null },
    ],
  };

  it("usa la misma serie de la última vez", () => {
    expect(cargaPrecargada(ultimaVez, 1)).toBe(40);
    expect(cargaPrecargada(ultimaVez, 2)).toBe(42.5);
  });

  it("si ahora hace más series que entonces, usa la última que hizo", () => {
    expect(cargaPrecargada(ultimaVez, 4)).toBe(42.5);
  });

  it("devuelve null sin historial", () => {
    expect(cargaPrecargada(null, 1)).toBeNull();
    expect(cargaPrecargada({ series: [] }, 1)).toBeNull();
  });

  it("no precarga con la carga de un drop set ni de un calentamiento (D-64)", () => {
    const conExtras = {
      fecha: new Date("2026-10-10T13:00:00.000Z"),
      series: [
        { carga: 40, repeticiones: 10, rir: null },
        { carga: 30, repeticiones: 4, rir: null, tipo: "DROP_SET" as const },
        { carga: 42.5, repeticiones: 8, rir: null },
      ],
    };

    expect(cargaPrecargada(conExtras, 2)).toBe(42.5);
    expect(cargaPrecargada({ ...conExtras, series: [{ carga: 20, repeticiones: 12, rir: null, tipo: "CALENTAMIENTO" as const }] }, 1)).toBeNull();
  });
});

describe("formatearSerie", () => {
  it("carga, repeticiones y RIR con coma decimal", () => {
    expect(formatearSerie({ carga: 42.5, repeticiones: 8, rir: 2 })).toBe("42,5 kg × 8 · RIR 2");
  });

  it("RIR 0 es un valor, no 'vacío'", () => {
    expect(formatearSerie({ carga: 40, repeticiones: 6, rir: 0 })).toBe("40 kg × 6 · RIR 0");
  });

  it("sin RIR no agrega nada", () => {
    expect(formatearSerie({ carga: 40, repeticiones: 10, rir: null })).toBe("40 kg × 10");
  });

  it("sin carga (peso corporal) muestra solo las repeticiones", () => {
    expect(formatearSerie({ carga: 0, repeticiones: 12, rir: null })).toBe("12 reps");
  });
});

describe("describirHace", () => {
  const ahora = new Date("2026-10-16T15:00:00.000Z");

  it.each([
    ["2026-10-16T12:00:00.000Z", "hoy"],
    ["2026-10-15T20:00:00.000Z", "ayer"],
    ["2026-10-13T20:00:00.000Z", "hace 3 días"],
    ["2026-10-02T20:00:00.000Z", "hace 2 semanas"],
    ["2026-07-10T20:00:00.000Z", "hace 3 meses"],
  ])("%s → %s", (iso, esperado) => {
    expect(describirHace(new Date(iso), ahora)).toBe(esperado);
  });

  it("una fecha futura (reloj desfasado) se lee como 'hoy'", () => {
    expect(describirHace(new Date("2026-10-20T12:00:00.000Z"), ahora)).toBe("hoy");
  });
});

describe("describirSeries (T-046b, D-62)", () => {
  const s = (carga: number, repeticiones: number) => ({ carga, repeticiones, rir: 2 });

  it("agrupa las series iguales: cantidad × repeticiones a carga", () => {
    expect(describirSeries([s(40, 10), s(40, 10), s(40, 10)])).toBe("3 × 10 a 40 kg");
  });

  it("usa coma decimal", () => {
    expect(describirSeries([s(42.5, 8), s(42.5, 8)])).toBe("2 × 8 a 42,5 kg");
  });

  it("una sola serie también se resume", () => {
    expect(describirSeries([s(40, 10)])).toBe("1 × 10 a 40 kg");
  });

  it("si las series difieren, las lista una por una", () => {
    expect(describirSeries([s(40, 10), s(42.5, 8)])).toBe("40 kg × 10, 42,5 kg × 8");
  });

  it("sin carga (peso corporal) no inventa kilos", () => {
    expect(describirSeries([s(0, 12), s(0, 12)])).toBe("2 × 12");
    expect(describirSeries([s(0, 12), s(0, 10)])).toBe("12 reps, 10 reps");
  });

  it("sin series devuelve vacío", () => {
    expect(describirSeries([])).toBe("");
  });
});

describe("tipos de serie en el historial (T-047, D-64)", () => {
  it("agruparSesiones conserva el tipo de las series que no son normales", () => {
    const [sesion] = agruparSesiones([
      registro({ numeroSerie: 1 }),
      registro({ numeroSerie: 2, carga: 30, tipo: "DROP_SET" }),
      registro({ numeroSerie: 3, tipo: "HASTA_EL_FALLO" }),
    ]);

    expect(sesion.series.map((s) => s.tipo)).toEqual([undefined, "DROP_SET", "HASTA_EL_FALLO"]);
  });

  it("una serie normal no lleva `tipo` (el historial anterior a D-64 queda igual)", () => {
    const [sesion] = agruparSesiones([registro({ tipo: "NORMAL" }), registro({ numeroSerie: 2 })]);

    expect(sesion.series[0]).toEqual({ carga: 40, repeticiones: 10, rir: 2 });
    expect(sesion.series[1]).toEqual({ carga: 40, repeticiones: 10, rir: 2 });
  });

  it("formatearSerie agrega la etiqueta del tipo después del RIR", () => {
    expect(formatearSerie({ carga: 30, repeticiones: 12, rir: 0, tipo: "DROP_SET" })).toBe(
      "30 kg × 12 · RIR 0 · drop set"
    );
    expect(formatearSerie({ carga: 40, repeticiones: 6, rir: null, tipo: "HASTA_EL_FALLO" })).toBe(
      "40 kg × 6 · al fallo"
    );
  });

  it("formatearSerie no agrega nada a una serie normal", () => {
    expect(formatearSerie({ carga: 40, repeticiones: 10, rir: 2 })).toBe("40 kg × 10 · RIR 2");
    expect(formatearSerie({ carga: 40, repeticiones: 10, rir: 2, tipo: "NORMAL" })).toBe(
      "40 kg × 10 · RIR 2"
    );
  });

  it("describirSeries no esconde un drop set bajo el '3 × 10' de las demás", () => {
    // Mismas carga y repeticiones, pero una es un drop set: no se resume como "3 × 10 a 40 kg".
    const texto = describirSeries([
      { carga: 40, repeticiones: 10, rir: 2 },
      { carga: 40, repeticiones: 10, rir: 2 },
      { carga: 40, repeticiones: 10, rir: 2, tipo: "DROP_SET" },
    ]);

    expect(texto).toBe("40 kg × 10, 40 kg × 10, 40 kg × 10 (drop set)");
  });

  it("describirSeries etiqueta el tipo también cuando las series difieren", () => {
    const texto = describirSeries([
      { carga: 40, repeticiones: 8, rir: 2 },
      { carga: 30, repeticiones: 12, rir: 0, tipo: "DROP_SET" },
    ]);

    expect(texto).toBe("40 kg × 8, 30 kg × 12 (drop set)");
  });

  it("describirSeries de series todas iguales y normales sigue resumiendo", () => {
    expect(
      describirSeries([
        { carga: 40, repeticiones: 10, rir: 2 },
        { carga: 40, repeticiones: 10, rir: 2 },
      ])
    ).toBe("2 × 10 a 40 kg");
  });
});

