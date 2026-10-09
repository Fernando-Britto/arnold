/** @jest-environment node */
jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/home-interno-data");

import { buildHomeInternoPayload } from "@/api/home-interno-data";
import { GET } from "./route";

const build = buildHomeInternoPayload as jest.MockedFunction<typeof buildHomeInternoPayload>;

describe("GET /api/home-interno — Server-Timing (P-07)", () => {
  it("informa cuánto tardó en armar los datos, para medir sin herramientas extra", async () => {
    build.mockResolvedValue({ ahora: "2026-09-30T18:00:00.000Z" } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Server-Timing")).toMatch(/^datos;dur=\d+$/);
  });

  it("también lo informa cuando falla (500)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    build.mockRejectedValue(new Error("db down"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(res.headers.get("Server-Timing")).toMatch(/^datos;dur=\d+$/);
  });
});
