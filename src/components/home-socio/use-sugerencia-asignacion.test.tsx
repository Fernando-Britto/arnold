import { act, renderHook, waitFor } from "@testing-library/react";
import { useSugerenciaAsignacion } from "./use-sugerencia-asignacion";
import { fetchSugerencia } from "@/api/asignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { RespuestaSugerencia, SugerenciaDTO } from "@/api/asignaciones";

jest.mock("@/api/asignaciones-cliente");

const mockFetch = fetchSugerencia as jest.MockedFunction<typeof fetchSugerencia>;

const sugerencia: SugerenciaDTO = {
  asignacionId: "a-1",
  ejercicioId: "e-1",
  ejercicioNombre: "Press inclinado",
  maquinaId: "m-1",
  maquinaNombre: "Banco plano",
  esperaSegundos: 0,
  ahorroSegundos: 120,
  creadaEn: "2026-11-05T12:00:00.000Z",
  venceEn: "2026-11-05T12:15:00.000Z",
};

const conSugerencia = (id: string): RespuestaSugerencia => ({
  socioId: "socio-1",
  sugerencia: { ...sugerencia, asignacionId: id },
  siguienteEnOrden: null,
  calculadoEn: "2026-11-05T12:00:00.000Z",
});

const sinSugerencia: RespuestaSugerencia = {
  socioId: "socio-1",
  sugerencia: null,
  siguienteEnOrden: null,
  calculadoEn: "2026-11-05T12:00:00.000Z",
};

/** Promesa que el test resuelve a mano (para carreras). */
function diferida<T>() {
  let resolve!: (valor: T) => void;
  let reject!: (motivo: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function definirVisibilidad(valor: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => valor });
}

function dispararVisibilidad() {
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSugerenciaAsignacion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(conSugerencia("a-1"));
    definirVisibilidad("visible");
  });

  afterEach(() => {
    // Vuelve al getter de Document.prototype (jsdom: "visible").
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  it("arranca en cargando y consulta una sola vez al montar", async () => {
    const { result } = renderHook(() => useSugerenciaAsignacion());

    expect(result.current.estado.tipo).toBe("cargando");
    await waitFor(() => expect(result.current.estado.tipo).toBe("lista"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toMatchObject({ tipo: "lista", sugerencia: { asignacionId: "a-1" } });
  });

  it("reconsulta al volver la pestaña a visible y NO al ocultarse", async () => {
    const { result } = renderHook(() => useSugerenciaAsignacion());
    await waitFor(() => expect(result.current.estado.tipo).toBe("lista"));

    definirVisibilidad("hidden");
    act(() => dispararVisibilidad());
    expect(mockFetch).toHaveBeenCalledTimes(1);

    definirVisibilidad("visible");
    act(() => dispararVisibilidad());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("consultar() vuelve a pedir la sugerencia", async () => {
    const { result } = renderHook(() => useSugerenciaAsignacion());
    await waitFor(() => expect(result.current.estado.tipo).toBe("lista"));

    act(() => result.current.consultar());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("solo la última consulta escribe el estado (una respuesta vieja se descarta)", async () => {
    const primera = diferida<RespuestaSugerencia>();
    const segunda = diferida<RespuestaSugerencia>();
    mockFetch.mockReturnValueOnce(primera.promise).mockReturnValueOnce(segunda.promise);

    const { result } = renderHook(() => useSugerenciaAsignacion());
    act(() => result.current.consultar());

    await act(async () => {
      segunda.resolve(conSugerencia("nueva"));
    });
    await act(async () => {
      primera.resolve(conSugerencia("vieja"));
    });

    expect(result.current.estado).toMatchObject({ tipo: "lista", sugerencia: { asignacionId: "nueva" } });
  });

  it("aborta el pedido anterior al lanzar una consulta nueva", async () => {
    const primera = diferida<RespuestaSugerencia>();
    mockFetch.mockReturnValueOnce(primera.promise).mockResolvedValueOnce(conSugerencia("nueva"));

    const { result } = renderHook(() => useSugerenciaAsignacion());
    act(() => result.current.consultar());

    const signalPrimero = mockFetch.mock.calls[0][0];
    expect(signalPrimero?.aborted).toBe(true);
    await act(async () => {
      primera.resolve(conSugerencia("vieja"));
    });
    expect(result.current.estado).toMatchObject({ tipo: "lista", sugerencia: { asignacionId: "nueva" } });
  });

  it("aborta el pedido en vuelo al desmontar y no actualiza el estado", async () => {
    const pendiente = diferida<RespuestaSugerencia>();
    mockFetch.mockReturnValueOnce(pendiente.promise);

    const { unmount } = renderHook(() => useSugerenciaAsignacion());
    const signal = mockFetch.mock.calls[0][0];
    unmount();

    expect(signal?.aborted).toBe(true);
    // Resolver después del desmontaje no debe lanzar ni dejar warnings de act.
    await act(async () => {
      pendiente.resolve(sinSugerencia);
    });
  });

  it("un error deja el estado en error sin lanzar", async () => {
    mockFetch.mockRejectedValue(new ApiError(500, "boom"));

    const { result } = renderHook(() => useSugerenciaAsignacion());

    await waitFor(() => expect(result.current.estado.tipo).toBe("error"));
  });
});
