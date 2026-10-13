/** @jest-environment node */
/**
 * Auditoría de operaciones en POST /api/rutinas (finding C, P1).
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/api/rutinas");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleRutinaCreate } from "@/api/rutinas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { POST } from "./route";

const mockCreate = handleRutinaCreate as jest.MockedFunction<typeof handleRutinaCreate>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/rutinas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/rutinas — auditoría", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra ALTA con responsableId y rutinaId tras un alta exitosa", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockResolvedValueOnce({ id: "r1", nombre: "Full body" } as never);

    const res = await POST(postReq({ nombre: "Full body" }));

    expect(res.status).toBe(201);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ALTA",
      responsableId: "u-admin",
      detalles: { rutinaId: "r1" },
    });
  });

  it("no registra nada si el alta falla en el dominio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockRejectedValueOnce(new Error("VALIDATION_ERROR: nombre requerido"));

    const res = await POST(postReq({}));

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
