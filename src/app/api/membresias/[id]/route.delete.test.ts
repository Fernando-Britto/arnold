/** @jest-environment node */
/**
 * DELETE /api/membresias/[id] con NextResponse real (sin el mock global).
 * Regresión: `NextResponse.json(x, { status: 204 })` lanza
 * "Invalid response status code 204" -> 500 sin cuerpo -> el cliente falla en response.json().
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/membresias");

import { handleMembresiaDelete } from "@/api/membresias";
import { DELETE } from "./route";

const mockDelete = handleMembresiaDelete as jest.MockedFunction<typeof handleMembresiaDelete>;
const req = () =>
  new NextRequest("http://localhost:3000/api/membresias/m1", { method: "DELETE" });
const ctx = { params: Promise.resolve({ id: "m1" }) };

describe("DELETE /api/membresias/[id] (NextResponse real)", () => {
  it("204 sin cuerpo cuando se elimina", async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await DELETE(req(), ctx);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("409 con JSON cuando tiene socios asignados", async () => {
    mockDelete.mockRejectedValue(
      Object.assign(new Error("DELETE_BLOCKED_ASSIGNED: No se puede eliminar: 2 socios asignados"), {
        code: "DELETE_BLOCKED_ASSIGNED",
      })
    );

    const res = await DELETE(req(), ctx);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DELETE_BLOCKED_ASSIGNED");
  });
});
