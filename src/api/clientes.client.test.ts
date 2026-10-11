import { fetchClientes, createCliente, updateCliente, deleteCliente } from "./clientes";
import { ApiError } from "@/utils/api-error";

function respond(status: number, body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const input = {
  nombre: "Ana García", dni: "30123456", email: "ana@example.com",
  membresiaAsignada: "gold-1", estadoCuenta: "Activo" as const,
};

describe("API de Clientes (lado cliente): los errores llegan como ApiError", () => {
  it.each([
    ["fetchClientes", () => fetchClientes()],
    ["createCliente", () => createCliente(input)],
    ["updateCliente", () => updateCliente("c1", input)],
    ["deleteCliente", () => deleteCliente("c1")],
  ])("%s conserva status, code y message del servidor", async (_name, call) => {
    respond(403, { code: "FORBIDDEN", message: "Sin permiso" });
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: "FORBIDDEN", message: "Sin permiso" });
  });

  it("sin message en la respuesta usa un texto en español", async () => {
    respond(400, {});
    await expect(fetchClientes()).rejects.toThrow("No se pudieron cargar los clientes");
    await expect(deleteCliente("c1")).rejects.toThrow("No se pudo eliminar el cliente");
  });

  it("una respuesta ok sigue devolviendo los datos", async () => {
    respond(200, [{ id: "c1" }]);
    await expect(fetchClientes()).resolves.toEqual([{ id: "c1" }]);
  });
});
