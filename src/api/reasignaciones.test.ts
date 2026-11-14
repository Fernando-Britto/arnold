/** @jest-environment node */
jest.mock("@/domains/asignacion/reasignacion", () => ({ reasignarMaquina: jest.fn() }));

import { handleReasignar, handleSesionesEnCursoStaff, leerBodyReasignacion } from "./reasignaciones";
import { reasignarMaquina, type CodigoReasignacion, type TxReasignacion } from "@/domains/asignacion/reasignacion";

const mockReasignar = reasignarMaquina as jest.MockedFunction<typeof reasignarMaquina>;

const puerto = { enTransaccionBloqueada: async <T,>(fn: (tx: TxReasignacion) => Promise<T>) => fn({} as TxReasignacion) };

function fakeDb() {
  return {
    sesionDeEntrenamiento: { findMany: jest.fn().mockResolvedValue([]) },
    asignacionDeEjercicio: { findMany: jest.fn().mockResolvedValue([]) },
    ejercicio: { findMany: jest.fn().mockResolvedValue([]) },
    ejercicioMaquina: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const sesion = (over: Record<string, unknown> = {}) => ({
  id: "ses-2",
  socioId: "socio-1",
  horaInicio: new Date("2026-11-12T18:00:00.000Z"),
  ejercicioActualId: "e-1",
  socio: { usuario: { nombre: "Santiago Socio" } },
  rutinaAsignada: { rutina: { ejercicios: [{ ejercicioId: "e-1" }] } },
  ...over,
});

describe("handleSesionesEnCursoStaff", () => {
  it("arma el DTO con la fila EN_CURSO, la máquina y los candidatos", async () => {
    const db = fakeDb();
    db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesion()]);
    db.asignacionDeEjercicio.findMany.mockResolvedValue([
      { id: "asig-1", sesionId: "ses-2", ejercicioId: "e-1", maquinaId: "m-1" },
    ]);
    db.ejercicio.findMany.mockResolvedValue([{ id: "e-1", nombre: "Press inclinado" }]);
    db.ejercicioMaquina.findMany.mockResolvedValue([
      { ejercicioId: "e-1", maquina: { id: "m-1", nombre: "Banco plano", estado: "DISPONIBLE" } },
      { ejercicioId: "e-1", maquina: { id: "m-2", nombre: "Polea alta", estado: "OCUPADA" } },
    ]);

    const resultado = await handleSesionesEnCursoStaff(db);

    expect(resultado).toEqual([
      {
        sesionId: "ses-2",
        socioId: "socio-1",
        socioNombre: "Santiago Socio",
        horaInicio: "2026-11-12T18:00:00.000Z",
        ejercicioId: "e-1",
        ejercicioNombre: "Press inclinado",
        asignacionId: "asig-1",
        maquinaId: "m-1",
        maquinaNombre: "Banco plano",
        candidatos: [
          { id: "m-1", nombre: "Banco plano", estado: "DISPONIBLE" },
          { id: "m-2", nombre: "Polea alta", estado: "OCUPADA" },
        ],
      },
    ]);
  });

  it("una sesión sin fila EN_CURSO devuelve asignacionId y maquinaId en null", async () => {
    const db = fakeDb();
    db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesion()]);
    db.ejercicio.findMany.mockResolvedValue([{ id: "e-1", nombre: "Press inclinado" }]);

    const [fila] = await handleSesionesEnCursoStaff(db);

    expect(fila.asignacionId).toBeNull();
    expect(fila.maquinaId).toBeNull();
    expect(fila.maquinaNombre).toBeNull();
  });

  it("toma la fila EN_CURSO más reciente de cada sesión", async () => {
    const db = fakeDb();
    db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesion()]);
    // El repositorio ordena por creadaEn desc: el primero ya es el más reciente.
    db.asignacionDeEjercicio.findMany.mockResolvedValue([
      { id: "asig-nueva", sesionId: "ses-2", ejercicioId: "e-1", maquinaId: "m-nueva" },
      { id: "asig-vieja", sesionId: "ses-2", ejercicioId: "e-1", maquinaId: "m-vieja" },
    ]);
    const [fila] = await handleSesionesEnCursoStaff(db);

    expect(fila.asignacionId).toBe("asig-nueva");
  });

  it("solo consulta sesiones EN_CURSO con ejercicio actual y las ordena por hora de inicio", async () => {
    const db = fakeDb();

    await handleSesionesEnCursoStaff(db);

    expect(db.sesionDeEntrenamiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estadoDeFinalizacion: "EN_CURSO", ejercicioActualId: { not: null } },
        orderBy: { horaInicio: "asc" },
      })
    );
  });

  it("sin sesiones abiertas devuelve una lista vacía y no consulta el resto", async () => {
    const db = fakeDb();

    await expect(handleSesionesEnCursoStaff(db)).resolves.toEqual([]);
    expect(db.asignacionDeEjercicio.findMany).not.toHaveBeenCalled();
  });
});

describe("handleReasignar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReasignar.mockResolvedValue({
      tipo: "ok",
      asignacionId: "asig-2",
      maquinaId: "m-2",
      maquinaNombre: "Polea alta",
    });
  });

  it.each([
    [{ maquinaId: "m-2" }],
    [{ asignacionId: "a-1" }],
    [{ asignacionId: "a-1", maquinaId: "m-2", extra: true }],
    [{ asignacionId: "", maquinaId: "m-2" }],
    [{ asignacionId: 12, maquinaId: "m-2" }],
    ["no es objeto"],
  ])("un body inválido devuelve 400 (%j)", async (body) => {
    const resultado = await handleReasignar({
      body,
      responsableId: "u-1",
      ahora: new Date("2026-11-12T18:00:00.000Z"),
      puerto,
    });

    expect(resultado.status).toBe(400);
    expect(mockReasignar).not.toHaveBeenCalled();
  });

  it("devuelve 200 con la asignación nueva", async () => {
    const resultado = await handleReasignar({
      body: { asignacionId: "asig-1", maquinaId: "m-2" },
      responsableId: "u-1",
      ahora: new Date("2026-11-12T18:00:00.000Z"),
      puerto,
    });

    expect(resultado).toEqual({
      status: 200,
      body: { asignacionId: "asig-2", maquinaId: "m-2", maquinaNombre: "Polea alta" },
    });
  });

  it.each<[CodigoReasignacion, number, string]>([
    ["ASIGNACION_NO_ENCONTRADA", 404, "No encontramos esa ejecución en curso"],
    ["ASIGNACION_YA_TERMINADA", 409, "El socio ya terminó ese ejercicio"],
    ["MAQUINA_NO_CANDIDATA", 409, "Esa máquina no es una opción para este ejercicio"],
    ["MAQUINA_NO_DISPONIBLE", 409, "Esa máquina no está disponible"],
    ["MAQUINA_OCUPADA", 409, "Esa máquina está ocupada"],
  ])("mapea %s a %i con mensaje en español", async (codigo, status, message) => {
    mockReasignar.mockResolvedValue({ tipo: "error", codigo });

    const resultado = await handleReasignar({
      body: { asignacionId: "asig-1", maquinaId: "m-2" },
      responsableId: "u-1",
      ahora: new Date("2026-11-12T18:00:00.000Z"),
      puerto,
    });

    expect(resultado).toEqual({ status, body: { code: codigo, message } });
  });

  it("si la transacción falla devuelve 500", async () => {
    mockReasignar.mockRejectedValue(new Error("boom"));

    const resultado = await handleReasignar({
      body: { asignacionId: "asig-1", maquinaId: "m-2" },
      responsableId: "u-1",
      ahora: new Date("2026-11-12T18:00:00.000Z"),
      puerto,
    });

    expect(resultado).toMatchObject({ status: 500, body: { code: "SERVER_ERROR" } });
  });

  it("leerBodyReasignacion acepta solo los dos campos string", () => {
    expect(leerBodyReasignacion({ asignacionId: "a", maquinaId: "m" })).toEqual({
      asignacionId: "a",
      maquinaId: "m",
    });
    expect(leerBodyReasignacion({ asignacionId: "a", maquinaId: "m", otro: 1 })).toBeNull();
  });
});
