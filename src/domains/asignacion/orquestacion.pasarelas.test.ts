import {
  calcularEnCheckIn,
  calcularSinReservar,
  existeSocio,
  resolverSocioDeUsuario,
  tieneRutinaActiva,
} from "./orquestacion";
import {
  AHORA,
  crearPuerto,
  entradaLeida,
  exito,
  type PuertoFalso,
} from "../../../tests/factories/orquestacion-dobles";

const deps = (puerto: PuertoFalso) => ({ repositorio: puerto.repositorio });

describe("calcularSinReservar", () => {
  it("devuelve el siguiente en orden con su nombre y no escribe", async () => {
    // La rutina necesita ambos ejercicios: `exito()` pone E1 como siguiente.
    const puerto = crearPuerto({
      entrada: {
        ...entradaLeida(),
        rutina: {
          rutinaAsignadaId: "ra-1",
          ejercicios: [
            { ejercicioId: "E1", nombre: "Sentadilla", orden: 1, series: 2, descanso: 90, candidatos: ["M1"] },
            { ejercicioId: "E2", nombre: "Press banca", orden: 2, series: 3, descanso: 60, candidatos: ["M2"] },
          ],
        },
      },
    });

    const resultado = await calcularSinReservar(
      { socioId: "socio-1", ahora: AHORA },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(resultado).toEqual({
      ejercicioId: "E1",
      ejercicioNombre: "Sentadilla",
      maquinaId: "M1",
      esperaSegundos: 180,
    });
    expect(puerto.crearReserva).not.toHaveBeenCalled();
    expect(puerto.cancelarReservasActivas).not.toHaveBeenCalled();
    expect(puerto.enTransaccionBloqueada).not.toHaveBeenCalled();
  });

  it("degrada a null ante invalido, sin_opciones o error", async () => {
    const invalido = crearPuerto();
    expect(
      await calcularSinReservar(
        { socioId: "socio-1", ahora: AHORA },
        { repositorio: invalido.repositorio, motor: () => ({ tipo: "invalido", errores: ["x"] }) }
      )
    ).toBeNull();

    const vacio = crearPuerto();
    expect(
      await calcularSinReservar(
        { socioId: "socio-1", ahora: AHORA },
        { repositorio: vacio.repositorio, motor: () => ({ tipo: "vacio" }) }
      )
    ).toBeNull();

    const error = crearPuerto({ errorLectura: true });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await calcularSinReservar({ socioId: "socio-1", ahora: AHORA }, deps(error))).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][orquestacion]",
      expect.objectContaining({ socioId: "socio-1", contexto: "calcularSinReservar" })
    );
    log.mockRestore();
  });

  it("sin rutina activa devuelve null sin consultar el motor", async () => {
    const puerto = crearPuerto({ tieneRutina: false });
    const motor = jest.fn(() => exito());

    const resultado = await calcularSinReservar(
      { socioId: "socio-1", ahora: AHORA },
      { repositorio: puerto.repositorio, motor }
    );

    expect(resultado).toBeNull();
    expect(motor).not.toHaveBeenCalled();
  });
});

describe("calcularEnCheckIn", () => {
  it("no lanza si el motor falla y loguea", async () => {
    const puerto = crearPuerto();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const motor = () => {
      throw new Error("motor roto");
    };

    await expect(
      calcularEnCheckIn({ socioId: "socio-1", ahora: AHORA }, { repositorio: puerto.repositorio, motor })
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][orquestacion]",
      expect.objectContaining({ socioId: "socio-1", momento: "CHECK_IN" })
    );
    log.mockRestore();
  });

  it("no lanza si el puerto falla", async () => {
    const puerto = crearPuerto({ errorTransaccion: new Error("conexión perdida") });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(calcularEnCheckIn({ socioId: "socio-1", ahora: AHORA }, deps(puerto))).resolves
      .toBeUndefined();

    log.mockRestore();
  });
});

describe("pasarelas", () => {
  it("tieneRutinaActiva delega en el puerto", async () => {
    const conRutina = crearPuerto({ tieneRutina: true });
    expect(await tieneRutinaActiva("socio-1", deps(conRutina))).toBe(true);

    const sinRutina = crearPuerto({ tieneRutina: false });
    expect(await tieneRutinaActiva("socio-1", deps(sinRutina))).toBe(false);
  });

  it("resolverSocioDeUsuario delega en el puerto", async () => {
    const puerto = crearPuerto({ socioDeUsuario: "socio-9" });

    expect(await resolverSocioDeUsuario("usuario-1", deps(puerto))).toBe("socio-9");
    expect(puerto.resolverSocioPorUsuario).toHaveBeenCalledWith("usuario-1");
  });

  it("existeSocio delega en el puerto", async () => {
    const existe = crearPuerto({ socioExiste: true });
    expect(await existeSocio("socio-1", deps(existe))).toBe(true);

    const noExiste = crearPuerto({ socioExiste: false });
    expect(await existeSocio("socio-9", deps(noExiste))).toBe(false);
  });
});
