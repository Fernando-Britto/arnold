/**
 * Tipos de serie (T-047, D-64). Funciones y constantes puras: sin Prisma ni React.
 */
import {
  ETIQUETAS_TIPO_SERIE,
  MAX_DROPS,
  TIPOS_ELEGIBLES,
  SOLO_SERIES_DE_TRABAJO,
  etiquetaDeTipo,
  TIPOS_DE_SERIE,
  TIPO_SERIE_POR_DEFECTO,
  esTipoSerie,
} from "./tipo-serie";

describe("tipos de serie", () => {
  it("son cuatro y la serie normal es la de por defecto", () => {
    expect(TIPOS_DE_SERIE).toEqual(["NORMAL", "CALENTAMIENTO", "HASTA_EL_FALLO", "DROP_SET"]);
    expect(TIPO_SERIE_POR_DEFECTO).toBe("NORMAL");
  });

  it.each(["NORMAL", "CALENTAMIENTO", "HASTA_EL_FALLO", "DROP_SET"])("%s es un tipo válido", (tipo) => {
    expect(esTipoSerie(tipo)).toBe(true);
  });

  it.each([["normal"], ["Calentamiento"], ["OTRO"], [""], [null], [undefined], [1], [{}]])(
    "%p no es un tipo válido",
    (valor) => {
      expect(esTipoSerie(valor)).toBe(false);
    }
  );
});

describe("SOLO_SERIES_DE_TRABAJO", () => {
  it("es el filtro que deja afuera el calentamiento y nada más", () => {
    // Un solo lugar define qué cuenta como "serie de trabajo": progresión, marcas y volumen lo usan.
    expect(SOLO_SERIES_DE_TRABAJO).toEqual({ tipo: { not: "CALENTAMIENTO" } });
  });
});

describe("etiquetas de los tipos de serie (T-047 parte 2)", () => {
  it("cada tipo tiene un nombre para el selector", () => {
    expect(ETIQUETAS_TIPO_SERIE).toEqual({
      NORMAL: "Normal",
      CALENTAMIENTO: "Calentamiento",
      HASTA_EL_FALLO: "Al fallo",
      DROP_SET: "Drop set",
    });
  });

  it("la etiqueta corta del historial va en minúscula y la serie normal no tiene", () => {
    expect(etiquetaDeTipo("CALENTAMIENTO")).toBe("calentamiento");
    expect(etiquetaDeTipo("HASTA_EL_FALLO")).toBe("al fallo");
    expect(etiquetaDeTipo("DROP_SET")).toBe("drop set");
    expect(etiquetaDeTipo("NORMAL")).toBeNull();
    expect(etiquetaDeTipo(undefined)).toBeNull();
  });
});

describe("drop sets colgados de una serie (P-46, D-69)", () => {
  it("el socio elige el tipo entre tres: el drop set no es un tipo de serie que se elija, se agrega a una serie", () => {
    expect(TIPOS_ELEGIBLES).toEqual(["NORMAL", "CALENTAMIENTO", "HASTA_EL_FALLO"]);
    expect(TIPOS_ELEGIBLES).not.toContain("DROP_SET");
  });

  it("DROP_SET sigue siendo un tipo válido para lo ya guardado y para el historial", () => {
    expect(esTipoSerie("DROP_SET")).toBe(true);
  });

  it("una serie admite un número acotado de drop sets", () => {
    expect(MAX_DROPS).toBe(5);
  });
});
