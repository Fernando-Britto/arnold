import { reasignarMaquina, type TxReasignacion } from "./reasignacion";

const AHORA = new Date("2026-11-12T18:00:00.000Z");

interface Llamadas {
  cancelar: { id: string; sesionId: string }[];
  crear: { socioId: string; sesionId: string; ejercicioId: string; maquinaId: string }[];
  auditoria: Record<string, unknown>[];
}

function fakeTx(over: Partial<TxReasignacion> = {}) {
  const llamadas: Llamadas = { cancelar: [], crear: [], auditoria: [] };
  const tx: TxReasignacion = {
    leerEjecucion: async () => ({
      id: "asig-1",
      socioId: "socio-1",
      sesionId: "ses-1",
      ejercicioId: "e-1",
      maquinaId: "m-1",
    }),
    leerSesion: async () => ({ id: "ses-1", ejercicioActualId: "e-1" }),
    esCandidata: async () => true,
    leerMaquina: async () => ({ id: "m-2", nombre: "Polea alta", estado: "DISPONIBLE" }),
    maquinaOcupada: async () => false,
    cancelarEjecucion: async (id, sesionId) => {
      llamadas.cancelar.push({ id, sesionId });
      return true;
    },
    crearEjecucionEnCurso: async (datos) => {
      llamadas.crear.push(datos);
      return { id: "asig-2" };
    },
    registrarAuditoria: async (datos) => {
      llamadas.auditoria.push(datos.detalles);
    },
    ...over,
  };
  return { tx, llamadas };
}

async function ejecutar(tx: TxReasignacion) {
  return reasignarMaquina(
    { asignacionId: "asig-1", maquinaDestinoId: "m-2", responsableId: "user-instructor", ahora: AHORA },
    { enTransaccionBloqueada: (fn) => fn(tx) }
  );
}

describe("reasignarMaquina", () => {
  it("cancela la ejecución y crea la nueva en la misma sesión y ejercicio", async () => {
    const { tx, llamadas } = fakeTx();

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({
      tipo: "ok",
      asignacionId: "asig-2",
      maquinaId: "m-2",
      maquinaNombre: "Polea alta",
    });
    expect(llamadas.cancelar).toEqual([{ id: "asig-1", sesionId: "ses-1" }]);
    expect(llamadas.crear).toEqual([
      { socioId: "socio-1", sesionId: "ses-1", ejercicioId: "e-1", maquinaId: "m-2", ahora: AHORA },
    ]);
  });

  it("asigna máquina a una fila EN_CURSO sin máquina", async () => {
    const { tx, llamadas } = fakeTx({
      leerEjecucion: async () => ({
        id: "asig-1",
        socioId: "socio-1",
        sesionId: "ses-1",
        ejercicioId: "e-1",
        maquinaId: null,
      }),
    });

    const resultado = await ejecutar(tx);

    expect(resultado.tipo).toBe("ok");
    expect(llamadas.crear[0]).toMatchObject({ maquinaId: "m-2", sesionId: "ses-1", ejercicioId: "e-1" });
  });

  it("audita responsable, socio, ejercicio, máquina de origen y destino", async () => {
    const { tx, llamadas } = fakeTx();

    await ejecutar(tx);

    expect(llamadas.auditoria).toEqual([
      {
        socioId: "socio-1",
        ejercicioId: "e-1",
        asignacionOrigenId: "asig-1",
        maquinaOrigenId: "m-1",
        maquinaDestinoId: "m-2",
      },
    ]);
  });

  it("si la fila no existe no escribe nada", async () => {
    const { tx, llamadas } = fakeTx({ leerEjecucion: async () => null });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "ASIGNACION_NO_ENCONTRADA" });
    expect(llamadas).toEqual({ cancelar: [], crear: [], auditoria: [] });
  });

  it("si el socio ya avanzó de ejercicio devuelve ASIGNACION_YA_TERMINADA", async () => {
    const { tx, llamadas } = fakeTx({
      leerSesion: async () => ({ id: "ses-1", ejercicioActualId: "e-2" }),
    });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "ASIGNACION_YA_TERMINADA" });
    expect(llamadas.cancelar).toHaveLength(0);
  });

  it("si el guard de cancelación devuelve false no crea la fila nueva", async () => {
    const { tx, llamadas } = fakeTx({ cancelarEjecucion: async () => false });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "ASIGNACION_YA_TERMINADA" });
    expect(llamadas.crear).toHaveLength(0);
  });

  it("rechaza una máquina que no es candidata del ejercicio", async () => {
    const { tx, llamadas } = fakeTx({ esCandidata: async () => false });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "MAQUINA_NO_CANDIDATA" });
    expect(llamadas.cancelar).toHaveLength(0);
  });

  it("rechaza una máquina que no está DISPONIBLE", async () => {
    const { tx, llamadas } = fakeTx({
      leerMaquina: async () => ({ id: "m-2", nombre: "Polea alta", estado: "FUERA_DE_SERVICIO" }),
    });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "MAQUINA_NO_DISPONIBLE" });
    expect(llamadas.cancelar).toHaveLength(0);
  });

  it("rechaza una máquina ocupada por otro socio", async () => {
    const { tx, llamadas } = fakeTx({ maquinaOcupada: async () => true });

    const resultado = await ejecutar(tx);

    expect(resultado).toEqual({ tipo: "error", codigo: "MAQUINA_OCUPADA" });
    expect(llamadas.cancelar).toHaveLength(0);
  });

  it("si el create falla, el error se propaga para que la transacción revierta", async () => {
    const { tx } = fakeTx({
      crearEjecucionEnCurso: async () => {
        throw new Error("boom");
      },
    });

    await expect(ejecutar(tx)).rejects.toThrow("boom");
  });
});
