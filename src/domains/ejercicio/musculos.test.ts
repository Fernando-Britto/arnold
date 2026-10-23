/**
 * Músculos de un ejercicio (T-051, D-71): taxonomía canónica, peso de cada músculo y volumen.
 * Funciones puras: sin mocks.
 */
import {
  ETIQUETAS_MUSCULO,
  MUSCULOS,
  PESO_SECUNDARIO,
  musculoDesdeTermino,
  pesosDeMusculos,
  volumenPorMusculo,
} from "./musculos";

describe("MUSCULOS", () => {
  it("son los 18 que se pueden dibujar en un mapa corporal, de la cabeza a los pies", () => {
    expect(MUSCULOS).toHaveLength(18);
    expect(MUSCULOS[0]).toBe("trapecios");
    expect(MUSCULOS[MUSCULOS.length - 1]).toBe("tibial");
    expect(new Set(MUSCULOS).size).toBe(18);
  });

  it("cada músculo tiene su nombre en español para mostrarlo", () => {
    for (const m of MUSCULOS) expect(ETIQUETAS_MUSCULO[m]).toBeTruthy();
    expect(ETIQUETAS_MUSCULO["biceps"]).toBe("Bíceps");
    expect(ETIQUETAS_MUSCULO["zona-lumbar"]).toBe("Zona lumbar");
  });
});

describe("musculoDesdeTermino", () => {
  it.each([
    ["Pectorales", "pecho"],
    ["Pecho", "pecho"],
    ["Pecho superior", "pecho"],
    ["Deltoides", "deltoides"],
    ["Hombros", "deltoides"],
    ["Deltoides posteriores", "deltoides"],
    ["Manguito rotador", "deltoides"],
    ["Trapecio", "trapecios"],
    ["Trapecios", "trapecios"],
    ["Elevador de la escápula", "trapecios"],
    ["Dorsales", "espalda-alta"],
    ["Dorsal ancho", "espalda-alta"],
    ["Espalda", "espalda-alta"],
    ["Romboides", "espalda-alta"],
    ["Columna", "zona-lumbar"],
    ["Zona lumbar", "zona-lumbar"],
    ["Abdominales", "abdominales"],
    ["Zona media (core)", "abdominales"],
    ["Abdominales inferiores", "abdominales"],
    ["Braquial", "biceps"],
    ["Muñecas", "antebrazos"],
    ["Músculos de agarre", "antebrazos"],
    ["Abductores", "gluteos"],
    ["Ingle", "aductores"],
    ["Muslos internos", "aductores"],
    ["Sóleo", "gemelos"],
    ["Tibiales", "tibial"],
  ])("%s → %s", (termino, esperado) => {
    expect(musculoDesdeTermino(termino)).toBe(esperado);
  });

  it.each([["Manos"], ["Pies"], ["Tobillos"], ["Estabilizadores del tobillo"], ["Esternocleidomastoideo"], ["Sistema cardiovascular"]])(
    "%s no se dibuja en el mapa: devuelve null, no se inventa un músculo",
    (termino) => {
      expect(musculoDesdeTermino(termino)).toBeNull();
    }
  );

  it("no distingue mayúsculas, tildes ni espacios de más", () => {
    expect(musculoDesdeTermino("  bICEPS ")).toBe("biceps");
    expect(musculoDesdeTermino("triceps")).toBe("triceps");
    expect(musculoDesdeTermino("CUADRICEPS")).toBe("cuadriceps");
  });

  it("un término desconocido LANZA: mejor que falle el importador a que el volumen salga mal", () => {
    expect(() => musculoDesdeTermino("Músculo inventado")).toThrow(/músculo desconocido/i);
  });
});

describe("pesosDeMusculos", () => {
  it("el músculo objetivo pesa 1 y cada secundario distinto pesa 0,4", () => {
    expect(PESO_SECUNDARIO).toBe(0.4);

    const pesos = pesosDeMusculos({
      grupoMuscular: "Pecho",
      musculoObjetivo: "Pectorales",
      musculosSecundarios: ["Tríceps", "Hombros"],
    });

    expect(pesos).toEqual({ pecho: 1, triceps: 0.4, deltoides: 0.4 });
  });

  it("dos términos que son el mismo músculo cuentan UNA vez (Hombros y Deltoides)", () => {
    const pesos = pesosDeMusculos({
      grupoMuscular: "Hombros",
      musculoObjetivo: "Deltoides",
      musculosSecundarios: ["Hombros", "Deltoides posteriores", "Trapecio", "Trapecios"],
    });

    expect(pesos).toEqual({ deltoides: 1, trapecios: 0.4 });
  });

  it("si el secundario es el mismo músculo que el objetivo, manda el objetivo", () => {
    const pesos = pesosDeMusculos({
      grupoMuscular: "Espalda",
      musculoObjetivo: "Dorsales",
      musculosSecundarios: ["Espalda alta", "Bíceps"],
    });

    expect(pesos).toEqual({ "espalda-alta": 1, biceps: 0.4 });
  });

  it("lo que no se dibuja (manos, tobillos) se descarta sin romper", () => {
    const pesos = pesosDeMusculos({
      grupoMuscular: "Piernas",
      musculoObjetivo: "Gemelos",
      musculosSecundarios: ["Tobillos", "Pies", "Sóleo"],
    });

    expect(pesos).toEqual({ gemelos: 1 });
  });

  it("un ejercicio de cardio no entrena ningún músculo", () => {
    expect(
      pesosDeMusculos({ grupoMuscular: "Cardio", musculoObjetivo: "Sistema cardiovascular", musculosSecundarios: [] })
    ).toEqual({});
  });

  it("el cardio no suma músculos aunque el catálogo le anote secundarios (la bicicleta trae cuádriceps)", () => {
    expect(
      pesosDeMusculos({
        grupoMuscular: "Cardio",
        musculoObjetivo: "Sistema cardiovascular",
        musculosSecundarios: ["Cuádriceps", "Gemelos", "Isquiotibiales"],
      })
    ).toEqual({});
  });

  describe("sin músculos (ejercicios del seed o cargados a mano): se usa el grupo muscular", () => {
    it.each([
      ["Pecho", { pecho: 1 }],
      ["Hombros", { deltoides: 1 }],
      ["Brazos", { biceps: 0.5, triceps: 0.5 }],
      ["Espalda", { "espalda-alta": 0.75, "zona-lumbar": 0.25 }],
      ["Abdomen", { abdominales: 0.7, oblicuos: 0.3 }],
      ["Cuello", { trapecios: 1 }],
      ["Cardio", {}],
    ])("%s", (grupo, esperado) => {
      expect(pesosDeMusculos({ grupoMuscular: grupo })).toEqual(esperado);
    });

    it("Piernas reparte el peso entre tres músculos y suma 1", () => {
      const pesos = pesosDeMusculos({ grupoMuscular: "Piernas" });

      expect(Object.keys(pesos).sort()).toEqual(["cuadriceps", "gluteos", "isquiotibiales"]);
      expect(Object.values(pesos).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("los pesos de cada grupo suman 1 (un grupo no cuenta doble) salvo Cardio", () => {
      for (const grupo of ["Pecho", "Espalda", "Hombros", "Brazos", "Piernas", "Abdomen", "Cuello"]) {
        const suma = Object.values(pesosDeMusculos({ grupoMuscular: grupo })).reduce((a, b) => a + b, 0);
        expect(suma).toBeCloseTo(1, 10);
      }
    });

    it("un músculo objetivo vacío o nulo también cae al grupo", () => {
      expect(pesosDeMusculos({ grupoMuscular: "Pecho", musculoObjetivo: null })).toEqual({ pecho: 1 });
      expect(pesosDeMusculos({ grupoMuscular: "Pecho", musculoObjetivo: "  " })).toEqual({ pecho: 1 });
    });

    it("un grupo desconocido no rompe: no entrena nada", () => {
      expect(pesosDeMusculos({ grupoMuscular: "Otro" })).toEqual({});
    });
  });

  it("un término raro en la base se descarta sin romper (la integridad la cuida el test del catálogo)", () => {
    const pesos = pesosDeMusculos({
      grupoMuscular: "Pecho",
      musculoObjetivo: "Pectorales",
      musculosSecundarios: ["Algo nuevo", "Tríceps"],
    });

    expect(pesos).toEqual({ pecho: 1, triceps: 0.4 });
  });

  it("con músculo objetivo ignora el grupo aunque no coincidan", () => {
    expect(pesosDeMusculos({ grupoMuscular: "Brazos", musculoObjetivo: "Antebrazos" })).toEqual({ antebrazos: 1 });
  });
});

describe("volumenPorMusculo", () => {
  const pressBanca = {
    grupoMuscular: "Pecho",
    musculoObjetivo: "Pectorales",
    musculosSecundarios: ["Tríceps", "Hombros"],
  };
  const sentadilla = { grupoMuscular: "Piernas", musculoObjetivo: "Cuádriceps", musculosSecundarios: ["Glúteos"] };

  it("suma, por músculo, las series de cada ejercicio por su peso", () => {
    const v = volumenPorMusculo([
      { ejercicio: pressBanca, series: 4 },
      { ejercicio: sentadilla, series: 3 },
    ]);

    expect(v.pecho).toBeCloseTo(4, 10);
    expect(v.triceps).toBeCloseTo(1.6, 10);
    expect(v.deltoides).toBeCloseTo(1.6, 10);
    expect(v.cuadriceps).toBeCloseTo(3, 10);
    expect(v.gluteos).toBeCloseTo(1.2, 10);
  });

  it("un músculo que entrenan varios ejercicios acumula", () => {
    const press = { grupoMuscular: "Hombros", musculoObjetivo: "Deltoides", musculosSecundarios: ["Tríceps"] };

    const v = volumenPorMusculo([
      { ejercicio: pressBanca, series: 4 },
      { ejercicio: press, series: 3 },
    ]);

    // 4 × 0,4 de la banca + 3 × 0,4 del press de hombros.
    expect(v.triceps).toBeCloseTo(2.8, 10);
    // Hombros: 4 × 0,4 (banca) + 3 × 1 (press).
    expect(v.deltoides).toBeCloseTo(4.6, 10);
  });

  it("los músculos que no se entrenaron no aparecen (no hay ceros inventados)", () => {
    const v = volumenPorMusculo([{ ejercicio: pressBanca, series: 4 }]);

    expect(Object.keys(v).sort()).toEqual(["deltoides", "pecho", "triceps"]);
  });

  it("sin series o con series inválidas no suma nada", () => {
    expect(volumenPorMusculo([])).toEqual({});
    expect(volumenPorMusculo([{ ejercicio: pressBanca, series: 0 }])).toEqual({});
    expect(volumenPorMusculo([{ ejercicio: pressBanca, series: -3 }])).toEqual({});
    expect(volumenPorMusculo([{ ejercicio: pressBanca, series: Number.NaN }])).toEqual({});
  });
});
