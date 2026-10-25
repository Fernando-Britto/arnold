import {
  calcularEspera,
  esMaquinaUsable,
  type EjercicioPendiente,
  type EntradaMotor,
  type MaquinaEnGimnasio,
  type ResultadoMotor,
} from "./motor-espera";
const SEGUNDOS_POR_SERIE = 60;

function ejercicio(
  datos: Partial<EjercicioPendiente> & Pick<EjercicioPendiente, "id">
): EjercicioPendiente {
  return { orden: 1, series: 1, descanso: 90, candidatos: [], ...datos };
}

function maquina(
  datos: Partial<MaquinaEnGimnasio> & Pick<MaquinaEnGimnasio, "id">
): MaquinaEnGimnasio {
  return { estado: "DISPONIBLE", ocupante: null, cola: [], ...datos };
}

function entrada(overrides: Partial<EntradaMotor> = {}): EntradaMotor {
  return {
    ejercicios: [],
    maquinas: [],
    parametros: { segundosEjecucionSerie: SEGUNDOS_POR_SERIE },
    ...overrides,
  };
}

function esperarInvalido(resultado: ResultadoMotor): string[] {
  expect(resultado.tipo).toBe("invalido");
  if (resultado.tipo !== "invalido") {
    throw new Error("Se esperaba un resultado inválido");
  }
  return resultado.errores;
}

describe("calcularEspera", () => {
  describe("esMaquinaUsable", () => {
    it("considera usable el estado DISPONIBLE", () => {
      expect(esMaquinaUsable("DISPONIBLE")).toBe(true);
    });
    it("considera usable el estado OCUPADA", () => {
      expect(esMaquinaUsable("OCUPADA")).toBe(true);
    });
    it("considera no usable el estado FUERA_DE_SERVICIO", () => {
      expect(esMaquinaUsable("FUERA_DE_SERVICIO")).toBe(false);
    });
    it("considera no usable el estado INACTIVA", () => {
      expect(esMaquinaUsable("INACTIVA")).toBe(false);
    });
  });
  describe("validación de entrada", () => {
    it("rechaza series = 0", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", series: 0, candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1" })],
        })
      );

      const errores = esperarInvalido(resultado);
      expect(errores.length).toBeGreaterThanOrEqual(1);
    });
    it("rechaza descanso negativo", () => {
      const descansoPendiente = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", descanso: -1, candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1" })],
        })
      );
      expect(esperarInvalido(descansoPendiente).length).toBeGreaterThanOrEqual(1);

      const descansoOcupante = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: -1 } }),
          ],
        })
      );
      expect(esperarInvalido(descansoOcupante).length).toBeGreaterThanOrEqual(1);

      const descansoCola = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1", cola: [{ series: 2, descanso: -1 }] })],
        })
      );
      expect(esperarInvalido(descansoCola).length).toBeGreaterThanOrEqual(1);
    });
    it("rechaza segundosEjecucionSerie = 0", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1" })],
          parametros: { segundosEjecucionSerie: 0 },
        })
      );

      const errores = esperarInvalido(resultado);
      expect(errores.length).toBeGreaterThanOrEqual(1);
    });
  });
  describe("forma del resultado y espera base", () => {
    it("devuelve espera 0 y ahorro 0 en gimnasio vacío", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1" })],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 0, maquinaId: "M1" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 0, maquinaId: "M1" },
        ahorro: 0,
        bloqueados: [],
      });
    });
    it("devuelve vacio sin ejercicios pendientes", () => {
      expect(calcularEspera(entrada())).toEqual({ tipo: "vacio" });
    });
    it("valida antes de comprobar la lista vacía", () => {
      const resultado = calcularEspera(
        entrada({ parametros: { segundosEjecucionSerie: 0 } })
      );

      esperarInvalido(resultado);
    });
  });
  describe("espera de un ejercicio", () => {
    it("calcula la espera de un ocupante (fórmula conservadora)", () => {
      const base = entrada({
        ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
        maquinas: [
          maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: 90 } }),
        ],
      });

      const resultado = calcularEspera(base);

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 210, maquinaId: "M1" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 210, maquinaId: "M1" },
        ahorro: 0,
        bloqueados: [],
      });

      // El descanso del ejercicio pendiente se valida pero no entra en la espera.
      const pendienteConOtroDescanso = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", descanso: 30, candidatos: ["M1"] })],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: 90 } }),
          ],
        })
      );

      expect(pendienteConOtroDescanso).toEqual(resultado);
    });
    it("suma ocupante y cola de tres miembros", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
          maquinas: [
            maquina({
              id: "M1",
              ocupante: { seriesRestantes: 2, descanso: 90 },
              cola: [
                { series: 1, descanso: 90 },
                { series: 2, descanso: 90 },
                { series: 3, descanso: 90 },
              ],
            }),
          ],
        })
      );

      expect(resultado).toMatchObject({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 840, maquinaId: "M1" },
      });
    });
    it("trata candidatos vacíos como espera 0 sin bloqueo", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 2, candidatos: [] }),
            ejercicio({ id: "E2", orden: 1, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M2", ocupante: { seriesRestantes: 2, descanso: 90 } }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 0, maquinaId: null },
        siguienteEnOrden: { ejercicioId: "E2", espera: 210, maquinaId: "M2" },
        ahorro: 210,
        bloqueados: [],
      });
    });
    it("trata una OCUPADA heredada sin ocupante como usable y espera 0", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1"] })],
          maquinas: [maquina({ id: "M1", estado: "OCUPADA" })],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 0, maquinaId: "M1" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 0, maquinaId: "M1" },
        ahorro: 0,
        bloqueados: [],
      });
    });
  });
});
