import { handleMembresiasActivasRequest } from "./route";
import { handleMembresiasActivas } from "@/api/membresias";

jest.mock("@/api/membresias");
jest.mock("@/lib/db");

const mockHandler = handleMembresiasActivas as jest.MockedFunction<typeof handleMembresiasActivas>;

describe("GET /api/membresias/activas — Route Handler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve la lista del dropdown", async () => {
    const lista = [{ id: "m1", nombre: "Gold", precio: 15000, estado: "ACTIVA" as const }];
    mockHandler.mockResolvedValue(lista);
    await expect(handleMembresiasActivasRequest()).resolves.toEqual(lista);
  });

  it("mapea un error interno a { code, message, status } sin filtrar detalles", async () => {
    mockHandler.mockRejectedValue(new Error("connection refused: postgres://secret"));
    const result = await handleMembresiasActivasRequest();
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({ status: 500 });
    expect(JSON.stringify(result)).not.toContain("postgres://secret");
  });
});
