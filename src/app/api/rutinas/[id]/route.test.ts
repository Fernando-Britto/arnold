/** @jest-environment node */
/**
 * Auditoría de operaciones en PUT/DELETE /api/rutinas/[id] (finding C, P1).
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/app/api/rutinas/route", () => ({
  handleRutinaGetRequest: jest.fn(),
  handleRutinaUpdateRequest: jest.fn(),
  handleRutinaDeleteRequest: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleRutinaUpdateRequest, handleRutinaDeleteRequest } from "@/app/api/rutinas/route";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { PUT, DELETE } from "./route";

const mockUpdate = handleRutinaUpdateRequest as jest.Mock;
const mockDelete = handleRutinaDeleteRequest as jest.Mock;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const ctx = { params: Promise.resolve({ id: "r1" }) };
const jsonReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

describe("Auditoría de operaciones en /api/rutinas/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("PUT exitoso registra MODIFICACION con responsableId y rutinaId", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockUpdate.mockResolvedValueOnce({ id: "r1", nombre: "Full body v2", status: 200 });

    const res = await PUT(jsonReq({ nombre: "Full body v2" }), ctx);

    expect(res.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "MODIFICACION",
      responsableId: "u-admin",
      detalles: { rutinaId: "r1" },
    });
  });

  it("PUT fallido no registra nada", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockUpdate.mockResolvedValueOnce({ code: "VALIDATION_ERROR", message: "x", status: 400 });

    const res = await PUT(jsonReq({}), ctx);

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("DELETE exitoso registra BAJA con responsableId y rutinaId", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockDelete.mockResolvedValueOnce({ message: "Rutina eliminada exitosamente", status: 204 });

    const res = await DELETE(jsonReq(undefined), ctx);

    expect(res.status).toBe(204);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "BAJA",
      responsableId: "u-admin",
      detalles: { rutinaId: "r1" },
    });
  });

  it("DELETE bloqueado no registra nada", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockDelete.mockResolvedValueOnce({ code: "DELETE_BLOCKED", message: "x", status: 409 });

    const res = await DELETE(jsonReq(undefined), ctx);

    expect(res.status).toBe(409);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
