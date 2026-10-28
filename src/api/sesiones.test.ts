/**
 * Capa API de sesiones (T-037): los handlers server-side delegan en el dominio y resuelven
 * el socio a partir del usuario de la sesión. El dominio y Prisma van mockeados.
 */
import {
  handleIniciarSesion,
  handleRegistrarSerie,
  handleFinalizarSesion,
  handleSesionEnCurso,
  handleObtenerSesion,
  handleResumenSesion,
  resolveSocioIdDeUsuario,
  fetchSesionEnCurso,
  fetchResumenDeSesion,
  iniciarSesionDeEntrenamiento,
  registrarSerieDeEntrenamiento,
  finalizarSesionDeEntrenamiento,
} from "./sesiones";
import {
  iniciarSesion,
  registrarSerie,
  finalizarSesion,
  detalleSesionEnCurso,
  obtenerSesion,
  resumenDeSesion,
} from "@/domains/sesion/sesion-de-entrenamiento";

jest.mock("@/domains/sesion/sesion-de-entrenamiento");
jest.mock("@/lib/db", () => ({ prisma: { socio: { findUnique: jest.fn() } } }));

const mockIniciar = iniciarSesion as jest.MockedFunction<typeof iniciarSesion>;
const mockRegistrar = registrarSerie as jest.MockedFunction<typeof registrarSerie>;
const mockFinalizar = finalizarSesion as jest.MockedFunction<typeof finalizarSesion>;
const mockDetalle = detalleSesionEnCurso as jest.MockedFunction<typeof detalleSesionEnCurso>;
const mockObtener = obtenerSesion as jest.MockedFunction<typeof obtenerSesion>;
const mockResumen = resumenDeSesion as jest.MockedFunction<typeof resumenDeSesion>;

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as { socio: { findUnique: jest.Mock } };
}

describe("handlers de sesiones", () => {
  beforeEach(() => jest.clearAllMocks());

  it("handleIniciarSesion delega en iniciarSesion", async () => {
    const input = { socioId: "socio-1", rutinaAsignadaId: "asig-1" };
    mockIniciar.mockResolvedValueOnce({ sesion: { id: "s1" }, ejercicios: [] } as never);

    const r = await handleIniciarSesion(input);

    expect(r).toEqual({ sesion: { id: "s1" }, ejercicios: [] });
    expect(mockIniciar).toHaveBeenCalledWith(expect.objectContaining(input));
  });

  it("handleRegistrarSerie delega en registrarSerie", async () => {
    const input = { sesionId: "s1", ejercicioId: "ej-1", carga: 40, repeticiones: 10 };
    mockRegistrar.mockResolvedValueOnce({ registro: { id: "r1" }, sesion: { id: "s1" } } as never);

    const r = await handleRegistrarSerie(input);

    expect(r).toEqual({ registro: { id: "r1" }, sesion: { id: "s1" } });
    expect(mockRegistrar).toHaveBeenCalledWith(expect.objectContaining(input));
  });

  it("handleFinalizarSesion delega en finalizarSesion", async () => {
    mockFinalizar.mockResolvedValueOnce({ id: "s1", estadoDeFinalizacion: "COMPLETADA" } as never);

    const r = await handleFinalizarSesion({ sesionId: "s1" });

    expect(r).toEqual({ id: "s1", estadoDeFinalizacion: "COMPLETADA" });
    expect(mockFinalizar).toHaveBeenCalledWith({ sesionId: "s1" });
  });

  it("handleSesionEnCurso delega en detalleSesionEnCurso (con ejercicios y última serie)", async () => {
    const detalle = {
      sesion: { id: "s1" },
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
    };
    mockDetalle.mockResolvedValueOnce(detalle as never);

    expect(await handleSesionEnCurso("socio-1")).toEqual(detalle);
    expect(mockDetalle).toHaveBeenCalledWith("socio-1");
  });

  it("handleObtenerSesion delega en obtenerSesion", async () => {
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);

    const r = await handleObtenerSesion("s1");

    expect(r).toEqual({ id: "s1", socioId: "socio-1" });
    expect(mockObtener).toHaveBeenCalledWith("s1");
  });
});

describe("handleResumenSesion (T-046b, D-62)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delega en resumenDeSesion", async () => {
    const resumen = { sesionId: "s1", seriesHechas: 4, duracionMinutos: 45, ejercicios: [] };
    mockResumen.mockResolvedValueOnce(resumen);

    expect(await handleResumenSesion("s1")).toEqual(resumen);
    expect(mockResumen).toHaveBeenCalledWith("s1");
  });
});

describe("resolveSocioIdDeUsuario", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve el id del socio del usuario", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValueOnce({ id: "socio-1" });

    expect(await resolveSocioIdDeUsuario("u1")).toBe("socio-1");
    expect(prisma.socio.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: "u1" },
      select: { id: true },
    });
  });

  it("devuelve null si el usuario no tiene fila de socio", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValueOnce(null);

    expect(await resolveSocioIdDeUsuario("u1")).toBeNull();
  });
});

describe("fetchers del cliente de sesiones", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetchSesionEnCurso hace GET /api/sesiones?enCurso=1 y devuelve el detalle", async () => {
    const detalle = { sesion: null, ejercicios: [], ultimaSerie: null, cargaActual: null };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => detalle });

    const r = await fetchSesionEnCurso();

    expect(r).toEqual(detalle);
    // PG-7: la sesión va en cookie; el fetch no adjunta headers.
    expect(global.fetch).toHaveBeenCalledWith("/api/sesiones?enCurso=1");
  });

  it("iniciarSesionDeEntrenamiento hace POST con el rutinaAsignadaId", async () => {
    const resultado = { sesion: { id: "s1" }, ejercicios: [] };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => resultado });

    const r = await iniciarSesionDeEntrenamiento("asig-1");

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sesiones",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ rutinaAsignadaId: "asig-1" }),
      })
    );
  });

  it("registrarSerieDeEntrenamiento hace POST a /series con la serie", async () => {
    const resultado = { registro: { id: "reg-1" }, sesion: { id: "s1" } };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => resultado });

    const r = await registrarSerieDeEntrenamiento("s1", {
      ejercicioId: "ej-1",
      carga: 42.5,
      repeticiones: 10,
      rir: 2,
    });

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sesiones/s1/series",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ejercicioId: "ej-1", carga: 42.5, repeticiones: 10, rir: 2 }),
      })
    );
  });

  it("finalizarSesionDeEntrenamiento hace PUT a /api/sesiones/[id]", async () => {
    const resultado = { id: "s1", estadoDeFinalizacion: "COMPLETADA" };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => resultado });

    const r = await finalizarSesionDeEntrenamiento("s1");

    expect(r).toEqual(resultado);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sesiones/s1",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("fetchResumenDeSesion hace GET a /api/sesiones/[id]/resumen", async () => {
    const resumen = { sesionId: "s1", seriesHechas: 4, duracionMinutos: 45, ejercicios: [] };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => resumen });

    const r = await fetchResumenDeSesion("s1");

    expect(r).toEqual(resumen);
    expect(global.fetch).toHaveBeenCalledWith("/api/sesiones/s1/resumen");
  });

  it("fetchResumenDeSesion lanza si el servidor responde con error", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ code: "NOT_FOUND", message: "Sesión no encontrada" }),
    });

    await expect(fetchResumenDeSesion("s1")).rejects.toThrow();
  });
});
