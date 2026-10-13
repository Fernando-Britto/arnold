/** @jest-environment node */
/**
 * Auditoría de operaciones en POST /api/ejercicios (finding C, P1).
 * Un alta exitosa registra RegistroDeAuditoria (ALTA) con el responsable y el id del ejercicio.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/api/ejercicios");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleEjercicioCreate } from "@/api/ejercicios";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { POST } from "./route";

const mockCreate = handleEjercicioCreate as jest.MockedFunction<typeof handleEjercicioCreate>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/ejercicios", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/ejercicios — auditoría", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra ALTA con responsableId y ejercicioId tras un alta exitosa", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockResolvedValueOnce({ id: "e1", nombre: "Press" } as never);

    const res = await POST(postReq({ nombre: "Press" }));

    expect(res.status).toBe(201);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ALTA",
      responsableId: "u-admin",
      detalles: { ejercicioId: "e1" },
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
