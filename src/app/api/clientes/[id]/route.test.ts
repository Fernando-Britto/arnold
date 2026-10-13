/** @jest-environment node */
/**
 * DELETE /api/clientes/[id] con NextResponse real (sin el mock global).
 * PG-6/H2: un socio con historial (asistencias, sesiones, progreso, pagos o cuotas)
 * debe responder 409 DELETE_BLOCKED_REFERENCES en lugar de un 500 por P2003 o de
 * un borrado silencioso que destruye cuotas y deja pagos huérfanos.
 * Un socio "limpio" sigue eliminándose con 204.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/auth", () => ({
  extractUserFromRequest: jest.fn(() => ({ id: "u-admin", rol: "ADMINISTRADOR" })),
}));
jest.mock("@/api/clientes");

import { handleClienteDelete } from "@/api/clientes";
import { DELETE } from "./route";

const mockDelete = handleClienteDelete as jest.MockedFunction<typeof handleClienteDelete>;

const req = () =>
  new NextRequest("http://localhost:3000/api/clientes/c1", { method: "DELETE" });
const ctx = { params: Promise.resolve({ id: "c1" }) };

describe("DELETE /api/clientes/[id]", () => {
  it("204 sin cuerpo cuando el socio no tiene historial", async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await DELETE(req(), ctx);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("409 DELETE_BLOCKED_REFERENCES cuando el socio tiene historial", async () => {
    // Misma forma que lanza el dominio: Error con prefijo en el mensaje (sin code).
    mockDelete.mockRejectedValue(
      new Error(
        "DELETE_BLOCKED_REFERENCES: No se puede eliminar el cliente porque tiene historial (asistencias, sesiones, progreso, pagos o cuotas)"
      )
    );

    const res = await DELETE(req(), ctx);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("DELETE_BLOCKED_REFERENCES");
    expect(body.message).toContain("tiene historial");
  });
});
