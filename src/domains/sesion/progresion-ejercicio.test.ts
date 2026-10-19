/**
 * Motor de progresión por ejercicio (T-046d, D-59). Funciones puras: sin Prisma ni React.
 *
 * Una serie "acierta" si se hizo con las repeticiones objetivo o más; si tiene menos repeticiones
 * o no se hizo, "falla". Si todas aciertan sube la carga; tres sesiones seguidas con fallos a la
 * misma carga disparan una descarga del 10 %.
 */
import {
  FALLOS_PARA_DESCARGAR,
  cargaInicial,
  leerSesion,
  rachaDeFallos,
  sugerirProximaCarga,
  type SesionLeida,
} from "./progresion-ejercicio";
import type { SesionHistorica } from "./historial-ejercicio";
import type { TipoSerie } from "./tipo-serie";

const PRESCRIPCION = { series: 3, repeticiones: 8 };
let dia = 0;

/** Sesión pasada con series `[carga, repeticiones]`; cada llamada es un día posterior. */
function sesion(...series: Array<[number, number]>): SesionHistorica {
  dia += 1;
  return {
    fecha: new Date(Date.UTC(2026, 8, dia, 15)),
    series: series.map(([carga, repeticiones]) => ({ carga, repeticiones, rir: 2 })),
  };
}
const acierta = (carga: number) => sesion([carga, 8], [carga, 8], [carga, 8]);
const falla = (carga: number) => sesion([carga, 8], [carga, 8], [carga, 6]);

describe("leerSesion", () => {
  it("cumple si todas las series llegan a las repeticiones objetivo", () => {
    expect(leerSesion(acierta(40), PRESCRIPCION)).toEqual({ carga: 40, cumplida: true });
  });

  it("se pasa de las repeticiones objetivo y sigue cumpliendo", () => {
    const s = sesion([40, 10], [40, 9], [40, 8]);
    expect(leerSesion(s, PRESCRIPCION).cumplida).toBe(true);
  });

  it("no cumple si una serie queda corta", () => {
    expect(leerSesion(falla(40), PRESCRIPCION).cumplida).toBe(false);
  });

  it("no cumple si hizo menos series que las planificadas", () => {
    const s = sesion([40, 8], [40, 8]);
    expect(leerSesion(s, PRESCRIPCION).cumplida).toBe(false);
  });

  it("una serie extra no cuenta: ni para cumplir ni para la carga", () => {
    // La 4ª, más pesada y corta, no debe ni arruinar la sesión ni subir la carga.
    const s = sesion([40, 8], [40, 8], [40, 8], [50, 3]);
    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 40, cumplida: true });
  });

  it("la carga de la sesión es la mayor de las series que cuentan", () => {
    const s = sesion([35, 8], [40, 8], [40, 8]);
    expect(leerSesion(s, PRESCRIPCION).carga).toBe(40);
  });

  it("sin repeticiones objetivo (0) no hay cómo cumplir", () => {
    expect(leerSesion(acierta(40), { series: 3, repeticiones: 0 }).cumplida).toBe(false);
  });
});

describe("rachaDeFallos", () => {
  const leida = (carga: number, cumplida: boolean): SesionLeida => ({ carga, cumplida });

  it("es 0 sin sesiones o si la última cumplió", () => {
    expect(rachaDeFallos([])).toBe(0);
    expect(rachaDeFallos([leida(40, false), leida(40, true)])).toBe(0);
  });

  it("cuenta los fallos seguidos desde la más reciente", () => {
    expect(rachaDeFallos([leida(40, true), leida(40, false), leida(40, false)])).toBe(2);
  });

  it("un acierto corta la racha", () => {
    expect(rachaDeFallos([leida(40, false), leida(40, true), leida(40, false)])).toBe(1);
  });

  it("un cambio de carga corta la racha: los fallos eran de otra carga", () => {
    expect(rachaDeFallos([leida(40, false), leida(40, false), leida(35, false)])).toBe(1);
  });
});

describe("sugerirProximaCarga", () => {
  it("sin historial es la primera vez y no sugiere carga", () => {
    const s = sugerirProximaCarga([], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "primera", carga: null });
    expect(s.motivo).toMatch(/primera vez/i);
  });

  it("sube el incremento si la última vez hizo todas las repeticiones", () => {
    const s = sugerirProximaCarga([acierta(40)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "subir", carga: 42.5 });
    expect(s.motivo).toContain("+2,5 kg");
  });

  it("usa el incremento configurado", () => {
    expect(sugerirProximaCarga([acierta(40)], PRESCRIPCION, 5).carga).toBe(45);
  });

  it("evita errores de coma flotante al sumar", () => {
    expect(sugerirProximaCarga([acierta(0.1)], PRESCRIPCION, 0.2).carga).toBe(0.3);
  });

  it("mantiene la carga tras un primer fallo y avisa cuántos intentos quedan", () => {
    const s = sugerirProximaCarga([falla(40)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "mantener", carga: 40 });
    expect(s.motivo).toContain("2 intentos más");
  });

  it("en el segundo fallo avisa que queda un intento (singular)", () => {
    const s = sugerirProximaCarga([falla(40), falla(40)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "mantener", carga: 40 });
    expect(s.motivo).toContain("1 intento más");
  });

  it(`descarga el 10 % tras ${FALLOS_PARA_DESCARGAR} fallos seguidos a la misma carga`, () => {
    const s = sugerirProximaCarga([falla(40), falla(40), falla(40)], PRESCRIPCION, 2.5);
    // 40 × 0,9 = 36 → la carga posible más cercana con discos de 2,5 es 35.
    expect(s).toMatchObject({ tipo: "descargar", carga: 35 });
    expect(s.motivo).toContain("3 sesiones seguidas");
    expect(s.motivo).toContain("35 kg");
  });

  it("después de descargar la racha empieza de cero", () => {
    const s = sugerirProximaCarga(
      [falla(40), falla(40), falla(40), falla(35)],
      PRESCRIPCION,
      2.5
    );
    expect(s).toMatchObject({ tipo: "mantener", carga: 35 });
    expect(s.motivo).toContain("2 intentos más");
  });

  it("después de descargar, si cumple, vuelve a subir", () => {
    const s = sugerirProximaCarga(
      [falla(40), falla(40), falla(40), acierta(35)],
      PRESCRIPCION,
      2.5
    );
    expect(s).toMatchObject({ tipo: "subir", carga: 37.5 });
  });

  it("nunca descarga hacia una carga igual o mayor: en el mínimo mantiene", () => {
    const s = sugerirProximaCarga([falla(2.5), falla(2.5), falla(2.5)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "mantener", carga: 2.5 });
    expect(s.motivo).toMatch(/más baja/i);
  });

  it("sin carga registrada no inventa un peso", () => {
    const s = sugerirProximaCarga([acierta(0)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "mantener", carga: null });
  });

  it("solo mira las sesiones del historial recibido, la más reciente es la última", () => {
    // Antes falló mucho, pero la última cumplió: sube.
    const s = sugerirProximaCarga([falla(40), falla(40), falla(40), acierta(40)], PRESCRIPCION, 2.5);
    expect(s).toMatchObject({ tipo: "subir", carga: 42.5 });
  });
});

describe("sugerirProximaCarga cuando la rutina cambió (planDesde)", () => {
  it("si todo el historial es de un plan anterior, mantiene la carga y lo explica", () => {
    const historial = [falla(40), falla(40), falla(40)];
    const despues = new Date(historial[2].fecha.getTime() + 60_000);
    const s = sugerirProximaCarga(historial, PRESCRIPCION, 2.5, despues);
    // Sin el cambio de plan esto sería una descarga injusta.
    expect(s).toMatchObject({ tipo: "mantener", carga: 40 });
    expect(s.motivo).toMatch(/cambió el plan/i);
  });

  it("las sesiones de antes del cambio no cuentan para la racha", () => {
    const antes = [falla(40), falla(40)];
    const cambio = new Date(antes[1].fecha.getTime() + 60_000);
    const s = sugerirProximaCarga([...antes, falla(40)], PRESCRIPCION, 2.5, cambio);
    expect(s).toMatchObject({ tipo: "mantener", carga: 40 });
    expect(s.motivo).toContain("2 intentos más");
  });

  it("las sesiones posteriores al cambio se juzgan normalmente", () => {
    const antes = [falla(40)];
    const cambio = new Date(antes[0].fecha.getTime() + 60_000);
    const s = sugerirProximaCarga([...antes, acierta(40)], PRESCRIPCION, 2.5, cambio);
    expect(s).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("sin planDesde se juzga todo el historial", () => {
    const historial = [falla(40), falla(40), falla(40)];
    expect(sugerirProximaCarga(historial, PRESCRIPCION, 2.5, null).tipo).toBe("descargar");
  });
});

describe("cargaInicial", () => {
  const ultimaVez = sesion([40, 8], [40, 8], [35, 8]);

  it("sin sugerencia ni historial no hay carga", () => {
    expect(cargaInicial(null, null, 1)).toBeNull();
  });

  it("al subir, todas las series arrancan con la carga sugerida", () => {
    const sug = { tipo: "subir" as const, carga: 42.5, motivo: "" };
    expect(cargaInicial(ultimaVez, sug, 1)).toBe(42.5);
    expect(cargaInicial(ultimaVez, sug, 3)).toBe(42.5);
  });

  it("al descargar, usa la carga sugerida", () => {
    const sug = { tipo: "descargar" as const, carga: 35, motivo: "" };
    expect(cargaInicial(ultimaVez, sug, 2)).toBe(35);
  });

  it("al mantener, cada serie repite la de la última vez", () => {
    const sug = { tipo: "mantener" as const, carga: 40, motivo: "" };
    expect(cargaInicial(ultimaVez, sug, 1)).toBe(40);
    expect(cargaInicial(ultimaVez, sug, 3)).toBe(35);
  });

  it("sin sugerencia usa la última vez", () => {
    expect(cargaInicial(ultimaVez, null, 3)).toBe(35);
  });

  it("en la primera vez no hay carga", () => {
    const sug = { tipo: "primera" as const, carga: null, motivo: "" };
    expect(cargaInicial(null, sug, 1)).toBeNull();
  });
});

describe("leerSesion con tipos de serie (T-047, D-64)", () => {
  /** Sesión pasada con series `[carga, repeticiones, tipo]`; sin tipo es una serie normal. */
  function conTipos(...series: Array<[number, number, TipoSerie?]>): SesionHistorica {
    dia += 1;
    return {
      fecha: new Date(Date.UTC(2026, 8, dia, 15)),
      series: series.map(([carga, repeticiones, tipo]) => ({
        carga,
        repeticiones,
        rir: 2,
        ...(tipo ? { tipo } : {}),
      })),
    };
  }

  it("el drop set cuelga de la serie anterior: no ocupa una serie de la rutina", () => {
    // 3 × 8: dos series de trabajo y un drop set que no reemplaza la tercera.
    const s = conTipos([40, 8], [40, 8], [30, 4, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 40, cumplida: false });
  });

  it("con las tres series de trabajo hechas, un drop set extra no cambia el juicio", () => {
    const s = conTipos([40, 8], [40, 8], [40, 8], [30, 4, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 40, cumplida: true });
  });

  it("el drop set no aporta carga de trabajo aunque tenga más peso registrado", () => {
    const s = conTipos([40, 8], [40, 8], [40, 8], [60, 3, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 40, cumplida: true });
  });

  it("el drop set no reemplaza a una serie de trabajo que faltó", () => {
    // 3 series pedidas, una de trabajo y dos drops: faltan dos series de trabajo.
    const s = conTipos([40, 8], [30, 5, "DROP_SET"], [20, 8, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION).cumplida).toBe(false);
  });

  it("una sesión de puros drop sets no cumple y no tiene carga de trabajo", () => {
    const s = conTipos([30, 10, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 0, cumplida: false });
  });

  it("una serie de trabajo corta sigue siendo un fallo aunque haya un drop set", () => {
    const s = conTipos([40, 8], [40, 6], [40, 8], [30, 5, "DROP_SET"]);

    expect(leerSesion(s, PRESCRIPCION).cumplida).toBe(false);
  });

  it("hasta el fallo cuenta como cualquier otra serie: si llega a las repeticiones cumple", () => {
    const s = conTipos([40, 8], [40, 8], [40, 9, "HASTA_EL_FALLO"]);

    expect(leerSesion(s, PRESCRIPCION)).toEqual({ carga: 40, cumplida: true });
  });

  it("hasta el fallo con menos repeticiones que el objetivo es un fallo: el peso es demasiado", () => {
    const s = conTipos([40, 8], [40, 8], [40, 5, "HASTA_EL_FALLO"]);

    expect(leerSesion(s, PRESCRIPCION).cumplida).toBe(false);
  });

  it("una sesión con las series de trabajo hechas y un drop set se sugiere subir", () => {
    const sugerencia = sugerirProximaCarga(
      [conTipos([40, 8], [40, 8], [40, 8], [30, 4, "DROP_SET"])],
      PRESCRIPCION,
      2.5
    );

    expect(sugerencia).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("tres sesiones con drop set no disparan una descarga por las repeticiones del drop", () => {
    const sesiones = [1, 2, 3].map(() =>
      conTipos([40, 8], [40, 8], [40, 8], [30, 3, "DROP_SET"])
    );

    expect(sugerirProximaCarga(sesiones, PRESCRIPCION, 2.5).tipo).toBe("subir");
  });
});

