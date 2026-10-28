import {
  calcularSinReservar,
  existeSocio,
  reservaVigente,
  resolverSocioDeUsuario,
  tieneRutinaActiva,
} from "@/domains/asignacion/orquestacion";
import type { SugerenciaVigenteLeida } from "@/domains/asignacion/asignacion-puerto";
import { handleObtenerSugerencia } from "./asignaciones";

jest.mock("@/domains/asignacion/orquestacion");

const mockResolverSocio = resolverSocioDeUsuario as jest.MockedFunction<
  typeof resolverSocioDeUsuario
>;
const mockExisteSocio = existeSocio as jest.MockedFunction<typeof existeSocio>;
const mockTieneRutina = tieneRutinaActiva as jest.MockedFunction<typeof tieneRutinaActiva>;
const mockReservaVigente = reservaVigente as jest.MockedFunction<typeof reservaVigente>;
const mockCalcularSinReservar = calcularSinReservar as jest.MockedFunction<typeof calcularSinReservar>;

const AHORA = new Date("2026-10-25T10:05:00.000Z");

const SUGERENCIA: SugerenciaVigenteLeida = {
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

const solicitud = (overrides: Record<string, unknown> = {}) => ({
  actor: { usuarioId: "usuario-1", rol: "SOCIO" as const },
  socioIdQuery: null,
  ahora: AHORA,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResolverSocio.mockResolvedValue("socio-1");
  mockExisteSocio.mockResolvedValue(true);
  mockTieneRutina.mockResolvedValue(true);
  mockReservaVigente.mockResolvedValue(SUGERENCIA);
  mockCalcularSinReservar.mockResolvedValue({
    ejercicioId: "E2",
    ejercicioNombre: "Sentadilla",
    maquinaId: "M2",
    esperaSegundos: 60,
  });
});

describe("handleObtenerSugerencia: lectura del socio", () => {
  it("socio con sugerencia vigente recibe 200 con la fila y el siguiente", async () => {
    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado).toEqual({
      status: 200,
      body: {
        socioId: "socio-1",
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
        calculadoEn: "2026-10-25T10:05:00.000Z",
      },
    });
    expect(mockResolverSocio).toHaveBeenCalledWith("usuario-1");
    expect(mockReservaVigente).toHaveBeenCalledWith({ socioId: "socio-1", ahora: AHORA });
  });

  it("socio sin sugerencia vigente recibe 200 con sugerencia null y siguiente", async () => {
    mockReservaVigente.mockResolvedValue(null);

    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado.status).toBe(200);
    expect(resultado.body).toEqual(
      expect.objectContaining({
        sugerencia: null,
        siguienteEnOrden: expect.objectContaining({ ejercicioId: "E2" }),
      })
    );
  });

  it("socio sin rutina activa recibe 200 con ambos null aunque exista una fila RESERVADA", async () => {
    mockTieneRutina.mockResolvedValue(false);

    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado).toEqual({
      status: 200,
      body: {
        socioId: "socio-1",
        sugerencia: null,
        siguienteEnOrden: null,
        calculadoEn: "2026-10-25T10:05:00.000Z",
      },
    });
    expect(mockReservaVigente).not.toHaveBeenCalled();
  });

  it("el GET no escribe: dos llamadas devuelven el mismo body", async () => {
    const primera = await handleObtenerSugerencia(solicitud());
    const segunda = await handleObtenerSugerencia(solicitud());

    expect(segunda).toEqual(primera);
    expect(mockReservaVigente).toHaveBeenCalledTimes(2);
  });
});

describe("handleObtenerSugerencia: propiedad, roles y errores", () => {
  it("SOCIO con socioId en la query recibe 403 aunque sea el propio", async () => {
    const resultado = await handleObtenerSugerencia(solicitud({ socioIdQuery: "socio-1" }));

    expect(resultado).toEqual({
      status: 403,
      body: {
        code: "FORBIDDEN",
        message: "No tiene permiso para realizar esta acción",
      },
    });
    expect(mockResolverSocio).not.toHaveBeenCalled();
    expect(mockReservaVigente).not.toHaveBeenCalled();
  });

  it("SOCIO inexistente recibe 404 Socio no encontrado", async () => {
    mockResolverSocio.mockResolvedValue(null);

    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado).toEqual({
      status: 404,
      body: { code: "NOT_FOUND", message: "Socio no encontrado" },
    });
  });

  it("ADMIN sin socioId recibe 400 VALIDATION_ERROR", async () => {
    const resultado = await handleObtenerSugerencia(
      solicitud({ actor: { usuarioId: "u-9", rol: "ADMINISTRADOR" } })
    );

    expect(resultado).toEqual({
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("socioId"),
      },
    });
  });

  it("ADMIN con socioId vacío recibe 400", async () => {
    const resultado = await handleObtenerSugerencia(
      solicitud({ actor: { usuarioId: "u-9", rol: "ADMINISTRADOR" }, socioIdQuery: "" })
    );

    expect(resultado.status).toBe(400);
    expect(resultado.body).toEqual(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: expect.stringContaining("socioId") })
    );
  });

  it("ADMIN con socio inexistente recibe 404 NOT_FOUND", async () => {
    mockExisteSocio.mockResolvedValue(false);

    const resultado = await handleObtenerSugerencia(
      solicitud({ actor: { usuarioId: "u-9", rol: "ADMINISTRADOR" }, socioIdQuery: "socio-9" })
    );

    expect(resultado).toEqual({
      status: 404,
      body: { code: "NOT_FOUND", message: "Socio no encontrado" },
    });
    expect(mockReservaVigente).not.toHaveBeenCalled();
  });

  it("ADMIN consulta a un socio existente y recibe 200", async () => {
    mockReservaVigente.mockResolvedValue({ ...SUGERENCIA, socioId: "socio-9" });

    const resultado = await handleObtenerSugerencia(
      solicitud({ actor: { usuarioId: "u-9", rol: "ADMINISTRADOR" }, socioIdQuery: "socio-9" })
    );

    expect(resultado.status).toBe(200);
    expect(resultado.body).toEqual(expect.objectContaining({ socioId: "socio-9" }));
    expect(mockExisteSocio).toHaveBeenCalledWith("socio-9");
  });

  it("INSTRUCTOR consulta a un socio existente y recibe 200", async () => {
    const resultado = await handleObtenerSugerencia(
      solicitud({ actor: { usuarioId: "u-8", rol: "INSTRUCTOR" }, socioIdQuery: "socio-9" })
    );

    expect(resultado.status).toBe(200);
  });

  it("si calcularSinReservar falla, responde 200 con siguiente null y loguea", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcularSinReservar.mockRejectedValue(new Error("motor roto"));

    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado.status).toBe(200);
    expect(resultado.body).toEqual(
      expect.objectContaining({ siguienteEnOrden: null, sugerencia: expect.objectContaining({ asignacionId: "a-1" }) })
    );
    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][api]",
      expect.objectContaining({ socioId: "socio-1", tipo: "siguiente" })
    );
    log.mockRestore();
  });

  it("un error inesperado del servicio devuelve 500 SERVER_ERROR sin detalles", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockReservaVigente.mockRejectedValue(new Error("conexión perdida: host interno"));

    const resultado = await handleObtenerSugerencia(solicitud());

    expect(resultado).toEqual({
      status: 500,
      body: { code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" },
    });
    log.mockRestore();
  });
});
