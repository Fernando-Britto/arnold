import { decidirSugerencia, reservaVigente } from "./orquestacion";
import {
  AHORA,
  crearPuerto,
  sugerencia,
  type PuertoFalso,
} from "../../../tests/factories/orquestacion-dobles";

const deps = (puerto: PuertoFalso) => ({ repositorio: puerto.repositorio });

const entrada = (accion: "ACEPTAR" | "ESPERAR") => ({
  socioId: "socio-1",
  accion,
  ahora: AHORA,
});

describe("decidirSugerencia", () => {
  it("ACEPTAR no escribe y es idempotente", async () => {
    const puerto = crearPuerto({ sugerencia: sugerencia() });

    const primera = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));
    const segunda = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(primera).toEqual({ tipo: "aceptada", reserva: sugerencia() });
    expect(segunda).toEqual(primera);
    expect(puerto.cancelarReserva).not.toHaveBeenCalled();
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    expect(puerto.crearReserva).not.toHaveBeenCalled();
  });

  it("ESPERAR cancela la reserva vigente", async () => {
    const puerto = crearPuerto({ sugerencia: sugerencia() });

    const resultado = await decidirSugerencia(entrada("ESPERAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "esperada" });
    expect(puerto.cancelarReserva).toHaveBeenCalledWith("a-1", AHORA);
    expect(puerto.crearReserva).not.toHaveBeenCalled();
  });

  it("ESPERAR sobre una reserva que venció entre lectura y escritura da YA_NO_VIGENTE", async () => {
    const puerto = crearPuerto({
      sugerencia: sugerencia(),
      cancelarReservaResultado: false,
    });

    const resultado = await decidirSugerencia(entrada("ESPERAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" });
    expect(puerto.cancelarReserva).toHaveBeenCalledWith("a-1", AHORA);
  });

  it("sin sugerencia y sin historial devuelve NUNCA_EXISTIO", async () => {
    const puerto = crearPuerto({ sugerencia: null, ultima: null });

    const resultado = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" });
    expect(puerto.leerUltimaAsignacion).toHaveBeenCalledWith("socio-1");
  });

  it("sin sugerencia con la última RESERVADA devuelve YA_NO_VIGENTE", async () => {
    const puerto = crearPuerto({
      sugerencia: null,
      ultima: { estado: "RESERVADA", creadaEn: new Date("2026-10-25T09:00:00.000Z") },
    });

    const resultado = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" });
  });

  it("sin sugerencia con CANCELADA dentro de la ventana devuelve YA_NO_VIGENTE", async () => {
    const puerto = crearPuerto({
      sugerencia: null,
      ultima: { estado: "CANCELADA", creadaEn: new Date("2026-10-25T09:55:00.000Z") },
    });

    const resultado = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" });
  });

  it("sin sugerencia con CANCELADA fuera de la ventana devuelve NUNCA_EXISTIO", async () => {
    const puerto = crearPuerto({
      sugerencia: null,
      ultima: { estado: "CANCELADA", creadaEn: new Date("2026-10-25T09:00:00.000Z") },
    });

    const resultado = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" });
  });

  it("un error del repositorio se contiene como contenido/ERROR y no propaga", async () => {
    const puerto = crearPuerto({ errorTransaccion: new Error("conexión perdida") });
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await decidirSugerencia(entrada("ACEPTAR"), deps(puerto));

    expect(resultado).toEqual({ tipo: "contenido", motivo: "ERROR" });
    expect(error).toHaveBeenCalledWith(
      "[ASIGNACION][orquestacion]",
      expect.objectContaining({ tipo: "error", socioId: "socio-1", accion: "ACEPTAR" })
    );
    error.mockRestore();
  });
});

describe("reservaVigente", () => {
  it("devuelve la sugerencia vigente del socio", async () => {
    const puerto = crearPuerto({ sugerencia: sugerencia() });

    const resultado = await reservaVigente({ socioId: "socio-1", ahora: AHORA }, deps(puerto));

    expect(resultado).toEqual(sugerencia());
    expect(puerto.leerSugerenciaVigente).toHaveBeenCalledWith("socio-1", AHORA);
  });

  it("sin sugerencia devuelve null", async () => {
    const puerto = crearPuerto({ sugerencia: null });

    expect(await reservaVigente({ socioId: "socio-1", ahora: AHORA }, deps(puerto))).toBeNull();
  });
});
