/**
 * Búsqueda y filtros del catálogo de ejercicios (T-052, D-72). Funciones puras: sin mocks.
 */
import { filtrarEjercicios, normalizarTexto, opcionesDeFiltro } from "./busqueda";

interface E {
  id: string;
  nombre: string;
  grupoMuscular: string;
  equipamiento: string | null;
  musculoObjetivo: string | null;
}

const e = (id: string, nombre: string, grupoMuscular: string, equipamiento: string | null = null, musculoObjetivo: string | null = null): E => ({
  id,
  nombre,
  grupoMuscular,
  equipamiento,
  musculoObjetivo,
});

const catalogo = [
  e("1", "Press de banca con barra", "Pecho", "Barra", "Pectorales"),
  e("2", "Curl de Bíceps con mancuernas", "Brazos", "Mancuerna", "Bíceps"),
  e("3", "Sentadilla", "Piernas", "Barra", "Cuádriceps"),
  e("4", "Press militar", "Hombros", "Barra", "Deltoides"),
  e("5", "Extensión de tríceps en polea", "Brazos", "Polea", "Tríceps"),
  e("6", "Flexiones", "Pecho", null, null),
];

const ids = (lista: E[]) => lista.map((x) => x.id);

describe("normalizarTexto", () => {
  it("minúsculas, sin tildes y con los espacios colapsados", () => {
    expect(normalizarTexto("  Bíceps   CURL ")).toBe("biceps curl");
    expect(normalizarTexto("Extensión")).toBe("extension");
    expect(normalizarTexto("ÑANDÚ")).toBe("nandu");
  });
});

describe("filtrarEjercicios", () => {
  it("sin filtros devuelve todos, en el mismo orden", () => {
    expect(ids(filtrarEjercicios(catalogo, {}))).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("un texto vacío o de puros espacios no filtra", () => {
    expect(filtrarEjercicios(catalogo, { texto: "   " })).toHaveLength(6);
  });

  it("no distingue mayúsculas ni tildes: 'biceps' encuentra 'Bíceps'", () => {
    expect(ids(filtrarEjercicios(catalogo, { texto: "biceps" }))).toEqual(["2"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "TRICEPS" }))).toEqual(["5"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "extension" }))).toEqual(["5"]);
  });

  it("todas las palabras tienen que aparecer, aunque no estén seguidas ni en orden", () => {
    expect(ids(filtrarEjercicios(catalogo, { texto: "press banca" }))).toEqual(["1"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "banca press" }))).toEqual(["1"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "press" }))).toEqual(["1", "4"]);
  });

  it("también busca en el grupo, el equipamiento y el músculo objetivo", () => {
    expect(ids(filtrarEjercicios(catalogo, { texto: "mancuerna" }))).toEqual(["2"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "pectorales" }))).toEqual(["1"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "piernas" }))).toEqual(["3"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "polea triceps" }))).toEqual(["5"]);
  });

  it("filtra por grupo muscular exacto", () => {
    expect(ids(filtrarEjercicios(catalogo, { grupo: "Brazos" }))).toEqual(["2", "5"]);
  });

  it("filtra por equipamiento exacto", () => {
    expect(ids(filtrarEjercicios(catalogo, { equipamiento: "Barra" }))).toEqual(["1", "3", "4"]);
  });

  it("combina texto, grupo y equipamiento (todos tienen que cumplirse)", () => {
    expect(ids(filtrarEjercicios(catalogo, { texto: "press", equipamiento: "Barra" }))).toEqual(["1", "4"]);
    expect(ids(filtrarEjercicios(catalogo, { texto: "press", grupo: "Hombros", equipamiento: "Barra" }))).toEqual(["4"]);
    expect(filtrarEjercicios(catalogo, { grupo: "Pecho", equipamiento: "Polea" })).toEqual([]);
  });

  it("un ejercicio sin equipamiento ni músculo (cargado a mano) se encuentra por nombre y no rompe", () => {
    expect(ids(filtrarEjercicios(catalogo, { texto: "flexiones" }))).toEqual(["6"]);
    expect(ids(filtrarEjercicios(catalogo, { equipamiento: "Barra", texto: "flexiones" }))).toEqual([]);
  });

  it("no modifica la lista original", () => {
    const copia = [...catalogo];

    filtrarEjercicios(catalogo, { texto: "press", grupo: "Pecho" });

    expect(catalogo).toEqual(copia);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(filtrarEjercicios(catalogo, { texto: "xyz123" })).toEqual([]);
  });
});

describe("opcionesDeFiltro", () => {
  it("valores distintos, sin vacíos ni nulos, ordenados sin tener en cuenta las tildes", () => {
    expect(opcionesDeFiltro(["Mancuerna", "Barra", null, "Máquina", "Barra", "", undefined, "Banda"])).toEqual([
      "Banda",
      "Barra",
      "Mancuerna",
      "Máquina",
    ]);
  });

  it("sin valores devuelve una lista vacía", () => {
    expect(opcionesDeFiltro([null, undefined, ""])).toEqual([]);
  });
});
