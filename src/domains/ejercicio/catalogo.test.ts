import { GRUPOS_MUSCULARES, validateEjercicio } from "./ejercicio";
import {
  CATEGORIAS_DATASET,
  construirEjercicioDelCatalogo,
  grupoDesdeCategoria,
  type EjercicioDelDataset,
  type Glosario,
} from "./catalogo";

describe("catálogo de ejercicios: categorías del dataset → grupos de Arnold (D-70)", () => {
  it("agrega Cuello y Cardio a la lista canónica sin quitar los seis grupos originales", () => {
    expect(GRUPOS_MUSCULARES).toEqual(
      expect.arrayContaining(["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Abdomen", "Cuello", "Cardio"])
    );
    expect(GRUPOS_MUSCULARES).toHaveLength(8);
  });

  it.each([
    ["chest", "Pecho"],
    ["back", "Espalda"],
    ["shoulders", "Hombros"],
    ["upper arms", "Brazos"],
    ["lower arms", "Brazos"],
    ["upper legs", "Piernas"],
    ["lower legs", "Piernas"],
    ["waist", "Abdomen"],
    ["neck", "Cuello"],
    ["cardio", "Cardio"],
  ])("la categoría %s va al grupo %s", (categoria, grupo) => {
    expect(grupoDesdeCategoria(categoria)).toBe(grupo);
  });

  it("cubre exactamente las 10 categorías del dataset", () => {
    expect([...CATEGORIAS_DATASET].sort()).toEqual(
      ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"]
    );
  });

  it("todo grupo devuelto es válido para validateEjercicio", () => {
    for (const categoria of CATEGORIAS_DATASET) {
      const v = validateEjercicio({ nombre: "Ejercicio de prueba", grupoMuscular: grupoDesdeCategoria(categoria) });
      expect(v.valid).toBe(true);
    }
  });

  it("falla con una categoría desconocida en lugar de inventar un grupo", () => {
    expect(() => grupoDesdeCategoria("tentaculos")).toThrow(/categor[ií]a/i);
  });

  it("ignora mayúsculas y espacios sobrantes", () => {
    expect(grupoDesdeCategoria("  Upper Arms ")).toBe("Brazos");
  });
});

describe("construirEjercicioDelCatalogo: de un registro del dataset a un ejercicio de Arnold en español (D-70)", () => {
  const glosario: Glosario = {
    equipamiento: { dumbbell: "Mancuerna" },
    musculos: { biceps: "Bíceps", forearms: "Antebrazos", brachialis: "Braquial" },
  };
  const nombres = { "0294": "Curl de bíceps con mancuernas" };
  const crudo: EjercicioDelDataset = {
    id: "0294",
    name: "dumbbell biceps curl",
    category: "upper arms",
    equipment: "dumbbell",
    target: "biceps",
    secondary_muscles: ["forearms", "brachialis", "forearms"],
    instruction_steps: { es: ["  Ponte de pie con una mancuerna en cada mano. ", "Flexiona los codos.", ""] },
    gif_url: "videos/0294-NbVPDMW.gif",
  };

  it("arma el ejercicio con nombre, grupo, equipamiento y músculos en español", () => {
    expect(construirEjercicioDelCatalogo(crudo, nombres, glosario)).toEqual({
      datasetId: "0294",
      nombre: "Curl de bíceps con mancuernas",
      grupoMuscular: "Brazos",
      equipamiento: "Mancuerna",
      musculoObjetivo: "Bíceps",
      musculosSecundarios: ["Antebrazos", "Braquial"],
      instrucciones: ["Ponete de pie con una mancuerna en cada mano.", "Flexioná los codos."],
      mediaId: "0294-NbVPDMW",
    });
  });

  it("pasa las instrucciones de castellano a español rioplatense (voseo y vocabulario)", () => {
    const e = construirEjercicioDelCatalogo(
      { ...crudo, instruction_steps: { es: ["Túmbate en el suelo y mantén el balón medicinal.", "Mientras bajas, repite."] } },
      nombres,
      glosario
    );
    expect(e.instrucciones).toEqual(["Acostate en el piso y mantené la pelota medicinal.", "Mientras bajás, repetí."]);
  });

  it("falla si falta la traducción del nombre, indicando el id", () => {
    expect(() => construirEjercicioDelCatalogo(crudo, {}, glosario)).toThrow(/0294/);
  });

  it("falla si falta traducir el equipamiento, indicando el término", () => {
    expect(() => construirEjercicioDelCatalogo(crudo, nombres, { ...glosario, equipamiento: {} })).toThrow(/dumbbell/);
  });

  it("falla si falta traducir un músculo, indicando el término", () => {
    expect(() =>
      construirEjercicioDelCatalogo(crudo, nombres, { ...glosario, musculos: { biceps: "Bíceps" } })
    ).toThrow(/forearms/);
  });

  it("falla si no hay instrucciones en español", () => {
    expect(() =>
      construirEjercicioDelCatalogo({ ...crudo, instruction_steps: { es: [" "] } }, nombres, glosario)
    ).toThrow(/instrucciones/i);
  });

  it("falla con una categoría desconocida en vez de inventar un grupo", () => {
    expect(() => construirEjercicioDelCatalogo({ ...crudo, category: "tentaculos" }, nombres, glosario)).toThrow(/categor/i);
  });

  it("el ejercicio armado pasa validateEjercicio", () => {
    const e = construirEjercicioDelCatalogo(crudo, nombres, glosario);
    expect(validateEjercicio({ nombre: e.nombre, grupoMuscular: e.grupoMuscular }).valid).toBe(true);
  });
});
