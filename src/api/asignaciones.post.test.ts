import {
  calcularSinReservar,
  decidirSugerencia,
  resolverSocioDeUsuario,
} from "@/domains/asignacion/orquestacion";
import type { SugerenciaVigenteLeida } from "@/domains/asignacion/asignacion-puerto";
import { handleDecidirSugerencia } from "./asignaciones";

jest.mock("@/domains/asignacion/orquestacion");

const mockResolverSocio = resolverSocioDeUsuario as jest.MockedFunction<
  typeof resolverSocioDeUsuario
>;
const mockDecidir = decidirSugerencia as jest.MockedFunction<typeof decidirSugerencia>;
const mockCalcularSinReservar = calcularSinReservar as jest.MockedFunction<typeof calcularSinReservar>;

const AHORA = new Date("2026-10-25T10:05:00.000Z");

const RESERVA: SugerenciaVigenteLeida = {
  id: "a-1",
  socioId: "socio-1",
  ejercicioId: "E1",
  ejercicioNombre: "Press banca",
  maquinaId: "M1",
  maquinaNombre: "Banco 1",
  esperaSegundos: 120,
  ahorroSegundos: 60,
  creadaEn: new Date("2026-10-25T10:00:00.000Z"),
  venceEn: new Date("2026-10-25T10:15:00.000Z"),
};

const solicitud = (body: unknown, rol: "SOCIO" | "ADMINISTRADOR" = "SOCIO") => ({
  actor: { usuarioId: "usuario-1", rol },
  body,
  ahora: AHORA,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResolverSocio.mockResolvedValue("socio-1");
  mockDecidir.mockResolvedValue({ tipo: "aceptada", reserva: RESERVA });
  mockCalcularSinReservar.mockResolvedValue({
    ejercicioId: "E2",
    ejercicioNombre: "Sentadilla",
    maquinaId: "M2",
    esperaSegundos: 60,
  });
});

describe("handleDecidirSugerencia: body y rol", () => {
  it("body con maquinaId devuelve 400 VALIDATION_ERROR", async () => {
    const resultado = await handleDecidirSugerencia(
      solicitud({ accion: "ACEPTAR", maquinaId: "M2" })
    );

    expect(resultado).toEqual({
      status: 400,
      body: { code: "VALIDATION_ERROR", message: expect.stringContaining("accion") },
    });
    expect(mockDecidir).not.toHaveBeenCalled();
  });

  it("body con socioId devuelve 400", async () => {
    const resultado = await handleDecidirSugerencia(
      solicitud({ accion: "ACEPTAR", socioId: "socio-9" })
    );

    expect(resultado.status).toBe(400);
    expect(mockDecidir).not.toHaveBeenCalled();
  });

  it("accion ELEGIR devuelve 400", async () => {
    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ELEGIR" }));

    expect(resultado.status).toBe(400);
    expect(resultado.body).toEqual(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });

  it("body no objeto devuelve 400", async () => {
    const resultado = await handleDecidirSugerencia(solicitud("ACEPTAR"));

    expect(resultado.status).toBe(400);
    expect(mockDecidir).not.toHaveBeenCalled();
  });

  it("accion ausente devuelve 400", async () => {
    const resultado = await handleDecidirSugerencia(solicitud({}));

    expect(resultado.status).toBe(400);
    expect(mockDecidir).not.toHaveBeenCalled();
  });

  it("rol distinto de SOCIO recibe 403 FORBIDDEN", async () => {
    const resultado = await handleDecidirSugerencia(
      solicitud({ accion: "ACEPTAR" }, "ADMINISTRADOR")
    );

    expect(resultado).toEqual({
      status: 403,
      body: { code: "FORBIDDEN", message: "No tiene permiso para realizar esta acción" },
    });
    expect(mockDecidir).not.toHaveBeenCalled();
  });

  it("el socio sale de la sesión, no del body", async () => {
    await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(mockResolverSocio).toHaveBeenCalledWith("usuario-1");
    expect(mockDecidir).toHaveBeenCalledWith(
      expect.objectContaining({ socioId: "socio-1", accion: "ACEPTAR", ahora: AHORA }),
      expect.objectContaining({ timeouts: expect.anything() })
    );
  });
});

describe("handleDecidirSugerencia: decisión y errores", () => {
  it("ACEPTAR devuelve 200 con la misma reserva y el mismo venceEn", async () => {
    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(resultado).toEqual({
      status: 200,
      body: {
        accion: "ACEPTAR",
        sugerencia: {
          asignacionId: "a-1",
          ejercicioId: "E1",
          ejercicioNombre: "Press banca",
          maquinaId: "M1",
          maquinaNombre: "Banco 1",
          esperaSegundos: 120,
          ahorroSegundos: 60,
          creadaEn: "2026-10-25T10:00:00.000Z",
          venceEn: "2026-10-25T10:15:00.000Z",
        },
        siguienteEnOrden: {
          ejercicioId: "E2",
          ejercicioNombre: "Sentadilla",
          maquinaId: "M2",
          esperaSegundos: 60,
        },
      },
    });
  });

  it("ACEPTAR repetido es idempotente", async () => {
    const primera = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));
    const segunda = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(segunda).toEqual(primera);
    expect(mockDecidir).toHaveBeenCalledTimes(2);
  });

  it("ESPERAR devuelve 200 con sugerencia null", async () => {
    mockDecidir.mockResolvedValue({ tipo: "esperada" });

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ESPERAR" }));

    expect(resultado.status).toBe(200);
    expect(resultado.body).toEqual(
      expect.objectContaining({ accion: "ESPERAR", sugerencia: null })
    );
  });

  it("NUNCA_EXISTIO devuelve 404 SIN_SUGERENCIA", async () => {
    mockDecidir.mockResolvedValue({ tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" });

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(resultado).toEqual({
      status: 404,
      body: { code: "SIN_SUGERENCIA", message: "No hay una sugerencia vigente" },
    });
    expect(mockCalcularSinReservar).not.toHaveBeenCalled();
  });

  it("YA_NO_VIGENTE devuelve 409 SIN_SUGERENCIA_VIGENTE", async () => {
    mockDecidir.mockResolvedValue({ tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" });

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ESPERAR" }));

    expect(resultado).toEqual({
      status: 409,
      body: {
        code: "SIN_SUGERENCIA_VIGENTE",
        message: "La sugerencia ya no está vigente; vuelva a consultar",
      },
    });
  });

  it("siguienteEnOrden se calcula después de la decisión", async () => {
    const orden: string[] = [];
    mockDecidir.mockImplementation(async () => {
      orden.push("decidir");
      return { tipo: "aceptada", reserva: RESERVA };
    });
    mockCalcularSinReservar.mockImplementation(async () => {
      orden.push("siguiente");
      return { ejercicioId: "E2", ejercicioNombre: "Sentadilla", maquinaId: "M2", esperaSegundos: 60 };
    });

    await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(orden).toEqual(["decidir", "siguiente"]);
  });

  it("si el siguiente falla, responde 200 con siguienteEnOrden null y loguea", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcularSinReservar.mockRejectedValue(new Error("motor roto"));

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(resultado.status).toBe(200);
    expect(resultado.body).toEqual(expect.objectContaining({ siguienteEnOrden: null }));
    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][api]",
      expect.objectContaining({ socioId: "socio-1", tipo: "siguiente" })
    );
    log.mockRestore();
  });

  it("contenido ERROR devuelve 500 SERVER_ERROR sin detalles", async () => {
    mockDecidir.mockResolvedValue({ tipo: "contenido", motivo: "ERROR" });

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(resultado).toEqual({
      status: 500,
      body: { code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" },
    });
  });

  it("contenido TIMEOUT devuelve 500 SERVER_ERROR", async () => {
    mockDecidir.mockResolvedValue({ tipo: "contenido", motivo: "TIMEOUT" });

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ESPERAR" }));

    expect(resultado).toEqual({
      status: 500,
      body: { code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" },
    });
  });

  it("un rechazo de decidirSugerencia devuelve 500 sin exponer el mensaje interno", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDecidir.mockRejectedValue(new Error("conexión perdida: host interno"));

    const resultado = await handleDecidirSugerencia(solicitud({ accion: "ACEPTAR" }));

    expect(resultado).toEqual({
      status: 500,
      body: { code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" },
    });
    log.mockRestore();
  });
});
