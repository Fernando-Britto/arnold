/** @jest-environment node */
/**
 * POST /api/peso — el socio registra un pesaje propio (T-048, D-65).
 * La capa API va mockeada; NextRequest/NextResponse son los reales.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/peso");
jest.mock("@/api/sesiones");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleRegistrarPeso } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { POST } from "./route";

const mockRegistrar = handleRegistrarPeso as jest.MockedFunction<typeof handleRegistrarPeso>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/peso", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/peso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);

    const res = await POST(postReq({ peso: 78.4 }));

    expect(res.status).toBe(401);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"])(
    "403 para %s: el peso es del socio y lo registra el socio",
    async (rol) => {
      mockUser.mockReturnValue({ id: "u-staff", rol });

      const res = await POST(postReq({ peso: 78.4 }));

      expect(res.status).toBe(403);
      expect(mockRegistrar).not.toHaveBeenCalled();
    }
  );

  it("404 si el usuario socio no tiene perfil de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce(null);

    const res = await POST(postReq({ peso: 78.4 }));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SOCIO_NOT_FOUND");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("400 con un cuerpo que no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await POST(postReq("{no es json"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("201: registra el pesaje del propio socio, no el de otro", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    const pesaje = { id: "m1", peso: 78.4, fecha: "2026-10-18T14:00:00.000Z" };
    mockRegistrar.mockResolvedValueOnce(pesaje as never);

    // Aunque mande un socioId en el cuerpo, se usa el del token: no se puede pesar a otro.
    const res = await POST(postReq({ peso: 78.4, socioId: "socio-ajeno" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(pesaje);
    expect(mockRegistrar).toHaveBeenCalledWith({ socioId: "socio-1", peso: 78.4 });
  });

  it("pasa el peso tal cual al dominio, que es quien valida el rango", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockRegistrar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: El peso tiene que estar entre 20 y 400 kg"));

    const res = await POST(postReq({ peso: 784 }));

    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.code).toBe("VALIDATION_ERROR");
    // El código interno no se expone en el mensaje (lo saca el mapeador de errores).
    expect(cuerpo.message).toBe("El peso tiene que estar entre 20 y 400 kg");
  });
});
