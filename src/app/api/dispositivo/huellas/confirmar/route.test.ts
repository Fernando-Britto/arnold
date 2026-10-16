/** @jest-environment node */
/**
 * POST /api/dispositivo/huellas/confirmar (T-041): el sensor reporta el resultado de una solicitud.
 * Autenticación por token de dispositivo, sin sesión de usuario.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/huellas");
jest.mock("@/lib/dispositivo-auth", () => ({ autenticarDispositivo: jest.fn() }));

import { confirmarSolicitud } from "@/api/huellas";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { POST } from "./route";

const mockAuth = autenticarDispositivo as jest.Mock;
const mockConfirmar = confirmarSolicitud as jest.MockedFunction<typeof confirmarSolicitud>;

const dispositivo = {
  id: "dev-1",
  nombre: "Puerta",
  tipo: "PUERTA",
  estado: "ACTIVO",
  tokenHash: "hash",
  ultimoContacto: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const req = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/dispositivo/huellas/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-dispositivo-token": "tok" },
  });

describe("POST /api/dispositivo/huellas/confirmar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin token de dispositivo", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(req({ huellaId: 4, accion: "enrolar", ok: true }));
    expect(res.status).toBe(401);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it("400 si faltan campos obligatorios", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    const res = await POST(req({ huellaId: 4, accion: "enrolar" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it("400 si la acción no es válida", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    const res = await POST(req({ huellaId: 4, accion: "otra", ok: true }));
    expect(res.status).toBe(400);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it("200 y delega la confirmación al servicio", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockConfirmar.mockResolvedValueOnce({ ok: true });

    const res = await POST(req({ huellaId: 4, accion: "enrolar", ok: true, motivo: "ok", duplicadoDe: 9 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockConfirmar).toHaveBeenCalledWith({
      huellaId: 4,
      accion: "enrolar",
      ok: true,
      motivo: "ok",
      duplicadoDe: 9,
    });
  });

  it("200 aunque el servicio reporte sin_solicitud_pendiente", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockConfirmar.mockResolvedValueOnce({ ok: false, motivo: "sin_solicitud_pendiente" });

    const res = await POST(req({ huellaId: 999, accion: "enrolar", ok: true }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
