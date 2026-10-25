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
  describe("forma del resultado y espera base", () => {
    it("devuelve sin_opciones cuando todos están bloqueados", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1", estado: "FUERA_DE_SERVICIO" }),
            maquina({ id: "M2", estado: "INACTIVA" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "sin_opciones",
        bloqueados: [
          { ejercicioId: "E1", motivo: "TODAS_FUERA_DE_SERVICIO" },
          { ejercicioId: "E2", motivo: "TODAS_INACTIVAS" },
        ],
      });
    });
  });
  describe("bloqueo y códigos de motivo", () => {
    it("bloquea con TODAS_FUERA_DE_SERVICIO una única candidata fuera de servicio", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1", estado: "FUERA_DE_SERVICIO" }),
            maquina({ id: "M2" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E2", espera: 0, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E2", espera: 0, maquinaId: "M2" },
        ahorro: 0,
        bloqueados: [{ ejercicioId: "E1", motivo: "TODAS_FUERA_DE_SERVICIO" }],
      });
    });
    it("bloquea con TODAS_INACTIVAS una única candidata inactiva", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M2"] }),
          ],
          maquinas: [
            maquina({ id: "M1", estado: "INACTIVA" }),
            maquina({ id: "M2" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E2", espera: 0, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E2", espera: 0, maquinaId: "M2" },
        ahorro: 0,
        bloqueados: [{ ejercicioId: "E1", motivo: "TODAS_INACTIVAS" }],
      });
    });
    it("bloquea con SIN_MAQUINA_USABLE cuando mezcla fuera de servicio e inactiva", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["M1", "M2"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["M3"] }),
          ],
          maquinas: [
            maquina({ id: "M1", estado: "FUERA_DE_SERVICIO" }),
            maquina({ id: "M2", estado: "INACTIVA" }),
            maquina({ id: "M3" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E2", espera: 0, maquinaId: "M3" },
        siguienteEnOrden: { ejercicioId: "E2", espera: 0, maquinaId: "M3" },
        ahorro: 0,
        bloqueados: [{ ejercicioId: "E1", motivo: "SIN_MAQUINA_USABLE" }],
      });
    });
    it("clasifica candidatas con id ausente", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [
            ejercicio({ id: "E1", orden: 1, candidatos: ["MX", "M2"] }),
            ejercicio({ id: "E2", orden: 2, candidatos: ["MY", "MZ"] }),
            ejercicio({ id: "E3", orden: 3, candidatos: ["M3"] }),
          ],
          maquinas: [maquina({ id: "M2", estado: "INACTIVA" }), maquina({ id: "M3" })],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E3", espera: 0, maquinaId: "M3" },
        siguienteEnOrden: { ejercicioId: "E3", espera: 0, maquinaId: "M3" },
        ahorro: 0,
        bloqueados: [
          { ejercicioId: "E1", motivo: "TODAS_INACTIVAS" },
          { ejercicioId: "E2", motivo: "SIN_MAQUINA_USABLE" },
        ],
      });
    });
  });
  describe("espera de un ejercicio", () => {
    it("elige la unidad libre entre dos unidades del mismo tipo", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1", "M2"] })],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 3, descanso: 90 } }),
            maquina({ id: "M2" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 0, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 0, maquinaId: "M2" },
        ahorro: 0,
        bloqueados: [],
      });
    });
    it("elige la primera candidata cuando las esperas empatan", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1", "M2"] })],
          maquinas: [maquina({ id: "M1" }), maquina({ id: "M2" })],
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
    it("elige la candidata de menor espera", () => {
      const resultado = calcularEspera(
        entrada({
          ejercicios: [ejercicio({ id: "E1", candidatos: ["M1", "M2"] })],
          maquinas: [
            maquina({ id: "M1", ocupante: { seriesRestantes: 2, descanso: 90 } }),
            maquina({ id: "M2" }),
          ],
        })
      );

      expect(resultado).toEqual({
        tipo: "exito",
        recomendado: { ejercicioId: "E1", espera: 0, maquinaId: "M2" },
        siguienteEnOrden: { ejercicioId: "E1", espera: 0, maquinaId: "M2" },
        ahorro: 0,
        bloqueados: [],
      });
    });
    it("devuelve maquinaId null para candidatas vacías", () => {
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
  });
});
