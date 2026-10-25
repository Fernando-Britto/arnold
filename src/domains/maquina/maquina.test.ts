import {
  ESTADOS_ASIGNABLES,
  MAX_EJERCIOS_POR_MAQUINA,
  validateMaquina,
  validarAsignacionEjercicios,
  validarAsignacionPrevia,
  normalizarTexto,
  normalizeMaquina,
  puedeEliminar,
  type Maquina,
  type MaquinaInput,
  type EstadoMaquina,
  type TipoEquipamiento,
  type EstadoAsignable,
} from "./maquina";

const maquinaValida: MaquinaInput = {
  nombre: "Polea baja",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
  estado: "DISPONIBLE" as EstadoMaquina,
};

describe("validateMaquina", () => {
  it("acepta una máquina válida", () => {
    const result = validateMaquina(maquinaValida);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rechaza nombre vacío o solo espacios", () => {
    const result = validateMaquina({ ...maquinaValida, nombre: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "El nombre debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza nombre de 1 carácter", () => {
    const result = validateMaquina({ ...maquinaValida, nombre: "A" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "El nombre debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza nombre de 81 caracteres", () => {
    const result = validateMaquina({ ...maquinaValida, nombre: "A".repeat(81) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "El nombre debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza ubicación vacía", () => {
    const result = validateMaquina({ ...maquinaValida, ubicacion: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "La ubicación debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza ubicación de 1 carácter", () => {
    const result = validateMaquina({ ...maquinaValida, ubicacion: "A" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "La ubicación debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza ubicación de 81 caracteres", () => {
    const result = validateMaquina({
      ...maquinaValida,
      ubicacion: "A".repeat(81),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "La ubicación debe tener entre 2 y 80 caracteres"
    );
  });

  it("rechaza tipoEquipamiento fuera del enum", () => {
    const result = validateMaquina({
      ...maquinaValida,
      tipoEquipamiento: "ELIPTICA" as TipoEquipamiento,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Tipo de equipamiento inválido");
  });

  it("rechaza estado OCUPADA con el mensaje del panel", () => {
    const result = validateMaquina({
      ...maquinaValida,
      estado: "OCUPADA" as EstadoMaquina,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "El estado OCUPADA no puede asignarse desde este panel"
    );
  });

  it("rechaza cualquier otro estado inválido con 'Estado inválido'", () => {
    const result = validateMaquina({
      ...maquinaValida,
      estado: "FOO" as EstadoMaquina,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Estado inválido");
    expect(result.errors).not.toContain(
      "El estado OCUPADA no puede asignarse desde este panel"
    );
  });

  it("rechaza estado undefined con 'Estado inválido'", () => {
    const result = validateMaquina({
      ...maquinaValida,
      estado: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Estado inválido");
    expect(result.errors).not.toContain(
      "El estado OCUPADA no puede asignarse desde este panel"
    );
  });

  it("acepta DISPONIBLE, FUERA_DE_SERVICIO e INACTIVA", () => {
    for (const estado of ESTADOS_ASIGNABLES) {
      const result = validateMaquina({ ...maquinaValida, estado });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

describe("normalizarTexto", () => {
  it("quita extremos y colapsa espacios internos", () => {
    expect(normalizarTexto("  Polea   baja  ")).toBe("Polea baja");
    expect(normalizarTexto("Sala   principal")).toBe("Sala principal");
    expect(normalizarTexto("  \t  Máquina\n  de   polea  ")).toBe(
      "Máquina de polea"
    );
  });
});

describe("normalizeMaquina", () => {
  it("conserva mayúsculas y tildes en el valor guardado", () => {
    const result = normalizeMaquina({
      nombre: "  Máquina de Polea  ",
      ubicacion: "  Sala   Principal  ",
      tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
      estado: "DISPONIBLE" as EstadoAsignable,
    });

    expect(result.nombre).toBe("Máquina de Polea");
    expect(result.ubicacion).toBe("Sala Principal");
    expect(result.tipoEquipamiento).toBe("MAQUINA_GUIADA");
    expect(result.estado).toBe("DISPONIBLE");
  });
});

describe("ESTADOS_ASIGNABLES", () => {
  it("no incluye OCUPADA", () => {
    expect(ESTADOS_ASIGNABLES).toEqual([
      "DISPONIBLE",
      "FUERA_DE_SERVICIO",
      "INACTIVA",
    ]);
    expect(ESTADOS_ASIGNABLES).not.toContain("OCUPADA");
  });
});

describe("puedeEliminar", () => {
  it("permite cuando ejerciciosAsociados es 0", () => {
    const maquina = {
      id: "m1",
      nombre: "Polea baja",
      ubicacion: "Sala principal",
      tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
      estado: "DISPONIBLE" as EstadoMaquina,
      fechaAlta: new Date(),
      updatedAt: new Date(),
    } satisfies Maquina;

    const result = puedeEliminar(maquina, { ejerciciosAsociados: 0 });
    expect(result).toEqual({ permitido: true, motivo: null });
  });

  it('bloquea con 3 y devuelve "3 ejercicios usan esta máquina"', () => {
    const maquina = {
      id: "m2",
      nombre: "Prensa de piernas",
      ubicacion: "Sala principal",
      tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
      estado: "DISPONIBLE" as EstadoMaquina,
      fechaAlta: new Date(),
      updatedAt: new Date(),
    } satisfies Maquina;

    const result = puedeEliminar(maquina, { ejerciciosAsociados: 3 });
    expect(result).toEqual({
      permitido: false,
      motivo: "3 ejercicios usan esta máquina",
    });
  });
});

describe("validarAsignacionEjercicios", () => {
  it("acepta ids distintos que existen y los devuelve tal cual", () => {
    const ids = ["e1", "e2", "e3"];
    const existentes = new Set(ids);
    const result = validarAsignacionEjercicios(ids, existentes);
    expect(result).toEqual({ ok: true, ejercicioIds: ids });
  });

  it("acepta el conjunto vacío y devuelve { ok: true, ejercicioIds: [] }", () => {
    const result = validarAsignacionEjercicios([], new Set());
    expect(result).toEqual({ ok: true, ejercicioIds: [] });
  });

  it("rechaza duplicados con VALIDATION_ERROR y el mensaje esperado", () => {
    const result = validarAsignacionEjercicios(
      ["e1", "e1"],
      new Set(["e1"])
    );
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Hay ejercicios duplicados en la asignación",
    });
  });

  it("rechaza ids desconocidos con VALIDATION_ERROR y el mensaje esperado", () => {
    const result = validarAsignacionEjercicios(
      ["e1", "e-desconocido"],
      new Set(["e1"])
    );
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Uno o más ejercicios no existen",
    });
  });

  it("rechaza 101 ids con VALIDATION_MAX_EJERCICIOS y el mensaje interpolado", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `e-${i}`);
    const existentes = new Set(ids);
    const result = validarAsignacionEjercicios(ids, existentes);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_MAX_EJERCICIOS",
      message: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina`,
    });
  });

  it("la precedencia es duplicados → máximo → inexistentes", () => {
    const ids = Array.from({ length: 101 }, (_, i) => (i === 0 ? "e-dup" : `e-${i}`));
    ids[1] = "e-dup"; // duplicate at two positions
    const existentes = new Set<string>();
    const result = validarAsignacionEjercicios(ids, existentes);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Hay ejercicios duplicados en la asignación",
    });
  });

  it("MAX_EJERCIOS_POR_MAQUINA vale 100", () => {
    expect(MAX_EJERCIOS_POR_MAQUINA).toBe(100);
  });
});

describe("validarAsignacionPrevia", () => {
  it("acepta ids distintos y el conjunto vacío sin mirar existencias", () => {
    expect(validarAsignacionPrevia(["e1", "e2"])).toEqual({
      ok: true,
      ejercicioIds: ["e1", "e2"],
    });
    expect(validarAsignacionPrevia([])).toEqual({ ok: true, ejercicioIds: [] });
  });

  it("rechaza duplicados con VALIDATION_ERROR", () => {
    expect(validarAsignacionPrevia(["e1", "e1"])).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Hay ejercicios duplicados en la asignación",
    });
  });

  it("rechaza más de MAX_EJERCIOS_POR_MAQUINA con VALIDATION_MAX_EJERCICIOS", () => {
    const ids = Array.from(
      { length: MAX_EJERCIOS_POR_MAQUINA + 1 },
      (_, i) => `e-${i}`
    );
    expect(validarAsignacionPrevia(ids)).toEqual({
      ok: false,
      code: "VALIDATION_MAX_EJERCICIOS",
      message: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina`,
    });
  });

  it("la precedencia es duplicados antes que máximo", () => {
    const ids = Array.from(
      { length: MAX_EJERCIOS_POR_MAQUINA + 1 },
      (_, i) => `e-${i}`
    );
    ids[1] = ids[0];
    expect(validarAsignacionPrevia(ids)).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });
});
