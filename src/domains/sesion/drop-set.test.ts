/**
 * Drop sets colgados de una serie (P-46, D-69): carga sugerida para el próximo drop. Función pura.
 */
import { cargaSugeridaDeDrop, FACTOR_DE_DROP } from "./drop-set";

describe("cargaSugeridaDeDrop", () => {
  it("baja un 20 % y redondea al disco más cercano (2,5 kg)", () => {
    expect(FACTOR_DE_DROP).toBe(0.8);
    expect(cargaSugeridaDeDrop(40)).toBe(32.5);
    expect(cargaSugeridaDeDrop(100)).toBe(80);
    expect(cargaSugeridaDeDrop(20)).toBe(15);
  });

  it("encadenando drops la carga sigue bajando", () => {
    const primero = cargaSugeridaDeDrop(40);
    const segundo = cargaSugeridaDeDrop(primero);

    expect(primero).toBe(32.5);
    expect(segundo).toBe(25);
    expect(segundo).toBeLessThan(primero);
  });

  it("un drop siempre baja: con cargas chicas, donde el redondeo no cambiaría nada, resta un disco", () => {
    expect(cargaSugeridaDeDrop(5)).toBe(2.5);
    expect(cargaSugeridaDeDrop(7.5)).toBeLessThan(7.5);
  });

  it("nunca sugiere una carga negativa", () => {
    expect(cargaSugeridaDeDrop(2.5)).toBe(0);
    expect(cargaSugeridaDeDrop(0)).toBe(0);
    expect(cargaSugeridaDeDrop(-3)).toBe(0);
  });

  it("respeta otro tamaño de disco", () => {
    expect(cargaSugeridaDeDrop(40, 5)).toBe(30);
    expect(cargaSugeridaDeDrop(100, 1)).toBe(80);
  });

  it("un valor inválido se lee como cero", () => {
    expect(cargaSugeridaDeDrop(Number.NaN)).toBe(0);
  });
});
