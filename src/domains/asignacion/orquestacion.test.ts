import { calcularYReservar, MARGEN_RESPUESTA_MS, TIMEOUT_CALCULO_MS } from "./orquestacion";
import {
  AHORA,
  crearPuerto,
  DIEZ_QUINCE,
  DIEZ_TREINTA,
  exito,
} from "../../../tests/factories/orquestacion-dobles";

describe("calcularYReservar", () => {
  it("calcula y persiste la instantánea exacta del motor", async () => {
    const puerto = crearPuerto();

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.crearReserva).toHaveBeenCalledWith({
      socioId: "socio-1",
      ejercicioId: "E2",
      maquinaId: "M2",
      esperaSegundos: 120,
      ahorroSegundos: 60,
      creadaEn: AHORA,
      venceEn: DIEZ_QUINCE,
    });
    expect(resultado).toEqual({
      tipo: "reservada",
      asignacionId: "a-1",
      ejercicioId: "E2",
      maquinaId: "M2",
      esperaSegundos: 120,
      ahorroSegundos: 60,
      venceEn: DIEZ_QUINCE,
    });
  });

  it("cancela la reserva anterior antes de crear la nueva en la misma transacción", async () => {
    const puerto = crearPuerto();

    await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "INICIO_RUTINA" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.llamadas).toEqual([
      "enTransaccionBloqueada",
      "leerEntradaMotor",
      "cancelarReservasActivas",
      "crearReserva",
    ]);
    expect(puerto.enTransaccionBloqueada).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1000,
      timeout: TIMEOUT_CALCULO_MS,
    });
    expect(TIMEOUT_CALCULO_MS).toBe(2000);
    expect(MARGEN_RESPUESTA_MS).toBe(250);
  });

  it("usa el ahora inyectado para creadaEn y venceEn", async () => {
    const puerto = crearPuerto({ configuracion: { minutosVencimientoReserva: 30 } });

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "POST_EJERCICIO" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.crearReserva).toHaveBeenCalledWith(
      expect.objectContaining({ creadaEn: AHORA, venceEn: DIEZ_TREINTA })
    );
    expect(resultado).toEqual(expect.objectContaining({ venceEn: DIEZ_TREINTA }));
  });

  it("pasa ahora y minutosInactividadSesion al plan de lectura", async () => {
    const puerto = crearPuerto({ configuracion: { minutosInactividadSesion: 45 } });

    await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN", excluirEjercicioIds: ["E3"] },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.leerEntradaMotor).toHaveBeenCalledWith({
      socioId: "socio-1",
      ahora: AHORA,
      minutosInactividadSesion: 45,
      excluirEjercicioIds: ["E3"],
    });
  });

  it("con la configuración por defecto vence a los 15 minutos y usa ventana de 30", async () => {
    const puerto = crearPuerto();

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.leerEntradaMotor).toHaveBeenCalledWith(
      expect.objectContaining({ minutosInactividadSesion: 30 })
    );
    expect(resultado).toEqual(expect.objectContaining({ venceEn: DIEZ_QUINCE }));
  });
});

describe("calcularYReservar: timeouts configurables (D-110)", () => {
  it("usa los timeouts recibidos en la transacción y en la carrera externa", async () => {
    jest.useFakeTimers();
    const puerto = crearPuerto({ nuncaResuelve: true });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const promesa = calcularYReservar(
        { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
        {
          repositorio: puerto.repositorio,
          motor: () => exito(),
          timeouts: { calculoMs: 5000, maxWaitMs: 700 },
        }
      );

      // Deja correr los awaits previos (gate de rutina) sin llegar al timeout.
      await jest.advanceTimersByTimeAsync(1);
      expect(puerto.enTransaccionBloqueada).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 700,
        timeout: 5000,
      });

      // La carrera externa vence en calculoMs + MARGEN_RESPUESTA_MS (5250), no en 2250.
      await jest.advanceTimersByTimeAsync(2249);
      await expect(Promise.race([promesa, Promise.resolve("sigue")])).resolves.toBe("sigue");

      await jest.advanceTimersByTimeAsync(3001);
      await expect(promesa).resolves.toEqual({ tipo: "contenido", motivo: "TIMEOUT" });
    } finally {
      error.mockRestore();
      jest.useRealTimers();
    }
  });
});
