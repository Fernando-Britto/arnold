import { calcularEspera, type ResultadoMotor } from "./motor-espera";
import { calcularYReservar } from "./orquestacion";
import {
  AHORA,
  crearPuerto,
  exito,
  type PuertoFalso,
} from "../../../tests/factories/orquestacion-dobles";

type Puerto = PuertoFalso;

const deps = (puerto: Puerto, motor: () => ResultadoMotor = exito) => ({
  repositorio: puerto.repositorio,
  motor,
});

const contenido = (motivo: "INVALIDO" | "ERROR" | "TIMEOUT") => ({ tipo: "contenido", motivo });

describe("calcularYReservar: fallback, inválido y errores", () => {
  it("sin rutina activa no abre transacción ni invoca el motor", async () => {
    const puerto = crearPuerto({ tieneRutina: false });
    const motor = jest.fn(exito);

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, motor)
    );

    expect(resultado).toEqual({ tipo: "fallback", motivo: "SIN_RUTINA" });
    expect(puerto.enTransaccionBloqueada).not.toHaveBeenCalled();
    expect(motor).not.toHaveBeenCalled();
  });

  it("si la rutina se desactiva entre el gate y la lectura devuelve fallback SIN_RUTINA", async () => {
    const puerto = crearPuerto({ entrada: null });
    const motor = jest.fn(exito);

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, motor)
    );

    expect(resultado).toEqual({ tipo: "fallback", motivo: "SIN_RUTINA" });
    expect(motor).not.toHaveBeenCalled();
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
  });

  it("sin_opciones cancela la reserva anterior y no crea fila, sin loguear error", async () => {
    const puerto = crearPuerto();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, () => ({ tipo: "sin_opciones", bloqueados: [] }))
    );

    expect(resultado).toEqual({ tipo: "fallback", motivo: "SIN_OPCIONES" });
    expect(puerto.cancelarReservasActivas).toHaveBeenCalledWith("socio-1", AHORA);
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("vacio cancela la reserva anterior y no crea fila", async () => {
    const puerto = crearPuerto();

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "INICIO_RUTINA" },
      deps(puerto, () => ({ tipo: "vacio" }))
    );

    expect(resultado).toEqual({ tipo: "fallback", motivo: "VACIO" });
    expect(puerto.cancelarReservasActivas).toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
  });

  it("maquinaId null cancela la reserva anterior y no crea fila", async () => {
    const puerto = crearPuerto();
    const sinMaquina: ResultadoMotor = {
      tipo: "exito",
      recomendado: { ejercicioId: "E2", espera: 0, maquinaId: null },
      siguienteEnOrden: { ejercicioId: "E2", espera: 0, maquinaId: null },
      ahorro: 0,
      bloqueados: [],
    };

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, () => sinMaquina)
    );

    expect(resultado).toEqual({ tipo: "fallback", motivo: "SIN_MAQUINA" });
    expect(puerto.cancelarReservasActivas).toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
  });

  it("invalido no cancela ni crea y loguea el contexto", async () => {
    const puerto = crearPuerto();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const errores = ["La duración de la serie debe ser mayor que cero"];

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, () => ({ tipo: "invalido", errores }))
    );

    expect(resultado).toEqual(contenido("INVALIDO"));
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[ASIGNACION][orquestacion]",
      expect.objectContaining({ tipo: "invalido", socioId: "socio-1", momento: "CHECK_IN", errores })
    );
    error.mockRestore();
  });

  it("una recomendación fuera de la rutina se trata como invalido", async () => {
    const puerto = crearPuerto();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const fueraDeRutina: ResultadoMotor = {
      tipo: "exito",
      recomendado: { ejercicioId: "E9", espera: 0, maquinaId: "M9" },
      siguienteEnOrden: { ejercicioId: "E9", espera: 0, maquinaId: "M9" },
      ahorro: 0,
      bloqueados: [],
    };

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, () => fueraDeRutina)
    );

    expect(resultado).toEqual(contenido("INVALIDO"));
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("la máquina recomendada debe ser candidata del ejercicio", async () => {
    const puerto = crearPuerto();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const noCandidata: ResultadoMotor = {
      tipo: "exito",
      recomendado: { ejercicioId: "E1", espera: 0, maquinaId: "M9" },
      siguienteEnOrden: { ejercicioId: "E1", espera: 0, maquinaId: "M9" },
      ahorro: 0,
      bloqueados: [],
    };

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto, () => noCandidata)
    );

    expect(resultado).toEqual(contenido("INVALIDO"));
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("un error del repositorio se contiene como ERROR y no propaga", async () => {
    const puerto = crearPuerto({ errorTransaccion: new Error("conexión perdida") });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      deps(puerto)
    );

    expect(resultado).toEqual(contenido("ERROR"));
    expect(error).toHaveBeenCalledWith(
      "[ASIGNACION][orquestacion]",
      expect.objectContaining({ tipo: "error", socioId: "socio-1", momento: "CHECK_IN" })
    );
    error.mockRestore();
  });

  it("un timeout devuelve contenido TIMEOUT y no lanza", async () => {
    jest.useFakeTimers();
    const puerto = crearPuerto({ nuncaResuelve: true });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const promesa = calcularYReservar(
        { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
        deps(puerto)
      );

      await jest.advanceTimersByTimeAsync(2250);

      await expect(promesa).resolves.toEqual(contenido("TIMEOUT"));
      expect(error).toHaveBeenCalledWith(
        "[ASIGNACION][orquestacion]",
        expect.objectContaining({ tipo: "timeout", socioId: "socio-1", momento: "CHECK_IN" })
      );
    } finally {
      error.mockRestore();
      jest.useRealTimers();
    }
  });

  it("segundosEjecucionSerie = 0 se contiene como invalido sin escribir", async () => {
    const puerto = crearPuerto({ configuracion: { segundosEjecucionSerie: 0 } });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      { repositorio: puerto.repositorio, motor: calcularEspera }
    );

    expect(resultado).toEqual(contenido("INVALIDO"));
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
