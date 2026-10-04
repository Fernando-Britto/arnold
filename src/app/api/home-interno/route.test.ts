import { handleHomeInternoRequest } from "./route";
import { buildHomeInternoPayload } from "@/api/home-interno-data";

jest.mock("@/api/home-interno-data");
jest.mock("@/lib/db");

const build = buildHomeInternoPayload as jest.MockedFunction<typeof buildHomeInternoPayload>;

describe("GET /api/home-interno — Route Handler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el payload", async () => {
    build.mockResolvedValue({ ahora: "2026-09-30T18:00:00.000Z" } as never);
    await expect(handleHomeInternoRequest()).resolves.toEqual({
      status: 200,
      body: { ahora: "2026-09-30T18:00:00.000Z" },
    });
  });

  it("500 con un mensaje genérico, sin filtrar el error interno", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    build.mockRejectedValue(new Error("password authentication failed for user postgres"));
    const r = await handleHomeInternoRequest();
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ code: "HOME_INTERNO_ERROR", message: "No se pudo cargar el resumen operativo" });
    expect(spy).toHaveBeenCalled(); // el detalle va al log del servidor, no al cliente
    spy.mockRestore();
  });
});
