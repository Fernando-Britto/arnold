import { SCRIPT_TEMA, aplicarTema, alternarTema, temaActual } from "./tema";

const limpiarTema = () => {
  delete document.documentElement.dataset.tema;
  document.cookie = "tema=; path=/; max-age=0";
};

describe("tema", () => {
  beforeEach(limpiarTema);

  it("sin preferencia, temaActual() cae en claro", () => {
    expect(temaActual()).toBe("claro");
  });

  it("aplicarTema('oscuro') escribe el atributo y la cookie", () => {
    aplicarTema("oscuro");
    expect(document.documentElement.dataset.tema).toBe("oscuro");
    expect(document.cookie).toContain("tema=oscuro");
  });

  it("alternarTema() pasa de oscuro a claro y persiste la elección", () => {
    aplicarTema("oscuro");
    alternarTema();
    expect(document.documentElement.dataset.tema).toBe("claro");
    expect(document.cookie).toContain("tema=claro");
  });

  it("el script inline del layout es JavaScript válido", () => {
    expect(() => new Function(SCRIPT_TEMA)).not.toThrow();
  });
});
