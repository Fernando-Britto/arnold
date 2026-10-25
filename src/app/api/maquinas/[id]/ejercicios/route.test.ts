/**
 * Route tests for GET/PUT /api/maquinas/[id]/ejercicios
 * T-054h — nested assignment route.
 */

import { GET, PUT } from "./route";
import {
  handleMaquinaEjerciciosGet,
  handleMaquinaEjerciciosPut,
} from "@/api/maquinas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import {
  MAX_EJERCIOS_POR_MAQUINA,
  type EjercicioAsociado,
} from "@/domains/maquina/maquina";

jest.mock("@/api/maquinas");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockRegistrarOperacion = registrarOperacion as jest.MockedFunction<
  typeof registrarOperacion
>;
const mockGet = handleMaquinaEjerciciosGet as jest.MockedFunction<
  typeof handleMaquinaEjerciciosGet
>;
const mockPut = handleMaquinaEjerciciosPut as jest.MockedFunction<
  typeof handleMaquinaEjerciciosPut
>;

const adminUser = { id: "u-admin", rol: "ADMINISTRADOR" };
const ctx = { params: Promise.resolve({ id: "m1" }) };

const getReq = () => ({}) as unknown as Parameters<typeof GET>[0];
const putReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof PUT>[0];
const brokenJsonReq = () =>
  ({
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  }) as unknown as Parameters<typeof PUT>[0];

const asociados: EjercicioAsociado[] = [
  { id: "e1", nombre: "Press banca", grupoMuscular: "Pecho" },
  { id: "e2", nombre: "Sentadilla", grupoMuscular: "Piernas" },
];

describe("Maquina [id]/ejercicios API — GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockReturnValue(adminUser);
  });

  it("devuelve la lista asociada con 200 y el id resuelto de await params", async () => {
    mockGet.mockResolvedValue(asociados);

    const res = await GET(getReq(), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(asociados);
    expect(mockGet).toHaveBeenCalledWith("m1");
  });

  it("responde 404 NOT_FOUND cuando la máquina no existe", async () => {
    mockGet.mockRejectedValue(
      Object.assign(new Error("NOT_FOUND: Máquina no encontrada"), {
        code: "NOT_FOUND",
      })
    );

    const res = await GET(getReq(), ctx);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: "NOT_FOUND",
      message: "Máquina no encontrada",
    });
  });

  it("responde 401 cuando no hay usuario autenticado", async () => {
    mockUser.mockReturnValue(null);

    const res = await GET(getReq(), ctx);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Token de autenticación inválido o faltante",
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("responde 403 para un rol distinto de ADMINISTRADOR y no llama al handler", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });

    const res = await GET(getReq(), ctx);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      code: "FORBIDDEN",
      message: "Se requiere rol de administrador",
    });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe("Maquina [id]/ejercicios API — PUT", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockReturnValue(adminUser);
  });

  it("responde 200 con la lista nueva y pasa id + body al handler", async () => {
    mockPut.mockResolvedValue(asociados);
    const body = { ejercicioIds: ["e1", "e2"] };

    const res = await PUT(putReq(body), ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(asociados);
    expect(mockPut).toHaveBeenCalledWith("m1", body);
  });

  it("responde 400 cuando el cuerpo no es JSON válido", async () => {
    const res = await PUT(brokenJsonReq(), ctx);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      message: "El cuerpo de la solicitud no es JSON válido",
    });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("responde 400 VALIDATION_MAX_EJERCICIOS con más de 100 ids", async () => {
    mockPut.mockRejectedValue(
      Object.assign(
        new Error(
          `VALIDATION_MAX_EJERCICIOS: No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina`
        ),
        { code: "VALIDATION_MAX_EJERCICIOS" }
      )
    );

    const res = await PUT(
      putReq({ ejercicioIds: Array.from({ length: 101 }, (_, i) => `e${i}`) }),
      ctx
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_MAX_EJERCICIOS",
      message: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina`,
    });
  });

  it("responde 404 NOT_FOUND sin escribir cuando la máquina no existe", async () => {
    mockPut.mockRejectedValue(
      Object.assign(new Error("NOT_FOUND: Máquina no encontrada"), {
        code: "NOT_FOUND",
      })
    );

    const res = await PUT(putReq({ ejercicioIds: ["e1"] }), ctx);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: "NOT_FOUND",
      message: "Máquina no encontrada",
    });
  });

  it("responde 403 para un rol distinto de ADMINISTRADOR sin llamar handler ni auditoría", async () => {
    mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });

    const res = await PUT(putReq({ ejercicioIds: [] }), ctx);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      code: "FORBIDDEN",
      message: "Se requiere rol de administrador",
    });
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockRegistrarOperacion).not.toHaveBeenCalled();
  });

  it("audita MODIFICACION con { maquinaId, ejerciciosAsignados } y el id del actor", async () => {
    mockPut.mockResolvedValue(asociados);

    await PUT(putReq({ ejercicioIds: ["e1", "e2"] }), ctx);

    expect(mockRegistrarOperacion).toHaveBeenCalledWith({
      tipoOperacion: "MODIFICACION",
      responsableId: "u-admin",
      detalles: { maquinaId: "m1", ejerciciosAsignados: 2 },
    });
  });

  it("un fallo de auditoría no cambia la respuesta 200", async () => {
    mockPut.mockResolvedValue(asociados);
    mockRegistrarOperacion.mockRejectedValue(new Error("audit exploded"));

    const res = await PUT(putReq({ ejercicioIds: ["e1"] }), ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(asociados);
  });
});
