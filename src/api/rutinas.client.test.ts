import { fetchRutinas, createRutina, updateRutina, deleteRutina } from "./rutinas";
import { ApiError } from "@/utils/api-error";

// Importar ./rutinas trae el repositorio, que importa la base: acá no se toca.
jest.mock("@/lib/db", () => ({ prisma: {} }));

function respond(status: number, body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const input = {
  nombre: "Fuerza Full Body", objetivoPrincipal: "Fuerza", frecuenciaSemanal: 3,
  duracionEstimada: 60, nivelDeDificultad: "BASICO" as const,
};

describe("API de Rutinas (lado cliente): los errores llegan como ApiError", () => {
  it.each([
    ["fetchRutinas", () => fetchRutinas()],
    ["createRutina", () => createRutina(input)],
    ["updateRutina", () => updateRutina("r1", input)],
    ["deleteRutina", () => deleteRutina("r1")],
  ])("%s conserva status, code y message del servidor", async (_name, call) => {
    respond(409, { code: "RUTINA_ASIGNADA", message: "Rutina asignada" });
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "RUTINA_ASIGNADA", message: "Rutina asignada" });
  });

  it("sin message en la respuesta usa un texto en español", async () => {
    respond(400, {});
    await expect(fetchRutinas()).rejects.toThrow("No se pudieron cargar las rutinas");
    await expect(deleteRutina("r1")).rejects.toThrow("No se pudo eliminar la rutina");
  });

  it("una respuesta ok sigue devolviendo los datos", async () => {
    respond(200, [{ id: "r1" }]);
    await expect(fetchRutinas()).resolves.toEqual([{ id: "r1" }]);
  });
});
