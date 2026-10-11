import { fetchEjercicios, createEjercicio, updateEjercicio, deleteEjercicio } from "./ejercicios";
import { ApiError } from "@/utils/api-error";

// Importar ./ejercicios trae el repositorio, que importa la base: acá no se toca.
jest.mock("@/lib/db", () => ({ prisma: {} }));

function respond(status: number, body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const input = { nombre: "Press Militar", grupoMuscular: "Hombros" };

describe("API de Ejercicios (lado cliente): los errores llegan como ApiError", () => {
  it.each([
    ["fetchEjercicios", () => fetchEjercicios()],
    ["createEjercicio", () => createEjercicio(input)],
    ["updateEjercicio", () => updateEjercicio("e1", input)],
    ["deleteEjercicio", () => deleteEjercicio("e1")],
  ])("%s conserva status, code y message del servidor", async (_name, call) => {
    respond(409, { code: "DELETE_BLOCKED_ASSIGNED", message: "Está asignado a rutinas" });
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "DELETE_BLOCKED_ASSIGNED", message: "Está asignado a rutinas" });
  });

  it("sin message en la respuesta usa un texto en español", async () => {
    respond(400, {});
    await expect(fetchEjercicios()).rejects.toThrow("No se pudieron cargar los ejercicios");
    await expect(deleteEjercicio("e1")).rejects.toThrow("No se pudo eliminar el ejercicio");
  });

  it("una respuesta ok sigue devolviendo los datos", async () => {
    respond(200, [{ id: "e1" }]);
    await expect(fetchEjercicios()).resolves.toEqual([{ id: "e1" }]);
  });
});
