/**
 * Progreso de la sesión de entrenamiento (T-049, D-67): cuántas series van, en qué ejercicio y
 * cuánto tiempo pasó. Funciones puras: sin mocks.
 */
import { contarProgreso, formatearTranscurrido, porcentajeDeProgreso } from "./progreso-sesion";

const ejercicios = [
  { id: "ej-1", series: 4, orden: 0 },
  { id: "ej-2", series: 3, orden: 1 },
  { id: "ej-3", series: 5, orden: 2 },
];

describe("contarProgreso", () => {
  it("al empezar: 0 series hechas, ejercicio 1, y el total de la rutina", () => {
    expect(contarProgreso(ejercicios, "ej-1", 1)).toEqual({
      hechas: 0,
      total: 12,
      ejercicioNumero: 1,
      ejerciciosTotal: 3,
    });
  });

  it("dentro del primer ejercicio: las series ya hechas son las anteriores a la actual", () => {
    expect(contarProgreso(ejercicios, "ej-1", 3).hechas).toBe(2);
  });

  it("en el segundo ejercicio suma las series completas del primero", () => {
    expect(contarProgreso(ejercicios, "ej-2", 2)).toEqual({
      hechas: 5,
      total: 12,
      ejercicioNumero: 2,
      ejerciciosTotal: 3,
    });
  });

  it("respeta el orden de la rutina aunque la lista llegue desordenada", () => {
    const desordenados = [ejercicios[2], ejercicios[0], ejercicios[1]];

    expect(contarProgreso(desordenados, "ej-3", 1)).toMatchObject({ hechas: 7, ejercicioNumero: 3 });
  });

  it("sin ejercicio actual (la rutina se completó) están todas hechas", () => {
    expect(contarProgreso(ejercicios, null, null)).toEqual({
      hechas: 12,
      total: 12,
      ejercicioNumero: 3,
      ejerciciosTotal: 3,
    });
  });

  it("una serie fuera de rango no pasa del total de ese ejercicio", () => {
    expect(contarProgreso(ejercicios, "ej-1", 99).hechas).toBe(4);
    expect(contarProgreso(ejercicios, "ej-1", 0).hechas).toBe(0);
  });

  it("sin número de serie cuenta desde la primera", () => {
    expect(contarProgreso(ejercicios, "ej-2", null).hechas).toBe(4);
  });

  it("un ejercicio actual que no está en la lista no inventa progreso", () => {
    expect(contarProgreso(ejercicios, "otro", 2)).toEqual({
      hechas: 0,
      total: 12,
      ejercicioNumero: null,
      ejerciciosTotal: 3,
    });
  });

  it("una rutina sin ejercicios queda en cero", () => {
    expect(contarProgreso([], null, null)).toEqual({
      hechas: 0,
      total: 0,
      ejercicioNumero: null,
      ejerciciosTotal: 0,
    });
  });
});

describe("porcentajeDeProgreso", () => {
  it("proporción de series hechas, entre 0 y 100", () => {
    expect(porcentajeDeProgreso(5, 10)).toBe(50);
    expect(porcentajeDeProgreso(0, 10)).toBe(0);
    expect(porcentajeDeProgreso(10, 10)).toBe(100);
  });

  it("sin series o con datos fuera de rango no se sale de la barra", () => {
    expect(porcentajeDeProgreso(0, 0)).toBe(0);
    expect(porcentajeDeProgreso(15, 10)).toBe(100);
    expect(porcentajeDeProgreso(-2, 10)).toBe(0);
  });
});

describe("formatearTranscurrido", () => {
  it.each([
    [0, "0:00"],
    [2_000, "0:02"],
    [59_999, "0:59"],
    [60_000, "1:00"],
    [754_000, "12:34"],
    [3_599_000, "59:59"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
  ])("%d ms → %s", (ms, esperado) => {
    expect(formatearTranscurrido(ms)).toBe(esperado);
  });

  it("un reloj desfasado (negativo) no muestra tiempo negativo", () => {
    expect(formatearTranscurrido(-5_000)).toBe("0:00");
  });

  it("un valor inválido se lee como cero", () => {
    expect(formatearTranscurrido(Number.NaN)).toBe("0:00");
  });
});
