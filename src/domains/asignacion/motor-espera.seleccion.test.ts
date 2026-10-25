import {
  calcularEspera,
  type EjercicioPendiente,
  type EntradaMotor,
  type MaquinaEnGimnasio,
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

describe("calcularEspera", () => {
  describe("selección del recomendado y del siguiente", () => {
    it("desempata por menor orden ante esperas iguales", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 2, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 1, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: 90 } }),
            maquina({ id: "M2", ocupante: { seriesRestantes: 2, descanso: 90 } }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E2", espera: 210, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E2", espera: 210, maquinaId: "M2" },
        ahorro: 0,
        bloqueados: [],
      });
    });
    it("desempata por posición con orden = 0", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 0, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 0, candidatos: ["M2"] }),
            ejercicio({ id: "E3", orden: 0, candidatos: ["M3"] }),
          ],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: 90 } }),
            maquina({ id: "M2", ocupante: { seriesRestantes: 2, descanso: 90 } }),
            maquina({ id: "M3", ocupante: { seriesRestantes: 2, descanso: 90 } }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 210, maquinaId: "M1" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 210, maquinaId: "M1" },
        ahorro: 0,
        bloqueados: [],
      });
    });
    it("ahorro 0 cuando recomendado y siguiente coinciden", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1" }),
            maquina({ id: "M2", ocupante: { seriesRestantes: 3, descanso: 90 } }),
          ],
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
    it("calcula ahorro positivo", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 3, descanso: 90 } }),
            maquina({ id: "M2", ocupante: { seriesRestantes: 1, descanso: 90 } }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E2", espera: 60, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 360, maquinaId: "M1" },
        ahorro: 300,
        bloqueados: [],
      });
    });
  });
  describe("determinismo y re-ejecución", () => {
    it("acepta la rutina completa con series = 1 (check-in)", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, series: 1, descanso: 90, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, series: 1, descanso: 90, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1" }),
            maquina({ id: "M2", ocupante: { seriesRestantes: 1, descanso: 90 } }),
          ],
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
    it("mismo input produce el mismo output", () => {
      const base = entrada({
        ejercicios: [
          ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
          ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
        ],
        maquinas: [
          maquina({ id: "M1", ocupante: { seriesRestantes: 3, descanso: 90 } }),
          maquina({ id: "M2", ocupante: { seriesRestantes: 1, descanso: 90 } }),
        ],
      });

      expect(calcularEspera(base)).toEqual(calcularEspera(base));
    });
  });
});
