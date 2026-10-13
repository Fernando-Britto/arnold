/** @jest-environment node */
/**
 * Auditoría de operaciones en POST /api/clientes (finding C, P1).
 * Un alta exitosa registra RegistroDeAuditoria (ALTA) con el responsable y el id del cliente;
 * un fallo de autorización o del dominio no registra nada.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/api/clientes");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleClienteCreate } from "@/api/clientes";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { POST } from "./route";

const mockCreate = handleClienteCreate as jest.MockedFunction<typeof handleClienteCreate>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/clientes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/clientes — auditoría", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra ALTA con responsableId y clienteId tras un alta exitosa", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockResolvedValueOnce({
      cliente: { id: "c1", nombre: "Ana" },
      tempPassword: "tmp-123",
    } as never);

    const res = await POST(postReq({ nombre: "Ana" }));

    expect(res.status).toBe(201);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ALTA",
      responsableId: "u-admin",
      detalles: { clienteId: "c1" },
    });
  });

  it("no registra nada sin sesión (401)", async () => {
    mockUser.mockReturnValue(null);

    const res = await POST(postReq({ nombre: "Ana" }));

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("no registra nada si el alta falla en el dominio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockRejectedValueOnce(new Error("VALIDATION_ERROR: falta el nombre"));

    const res = await POST(postReq({}));

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
