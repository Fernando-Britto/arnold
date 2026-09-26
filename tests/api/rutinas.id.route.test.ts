import * as roueteHandlers from "@/app/api/rutinas/[id]/route";
import {
  type GetSuccess,
  type GetError,
  type UpdateSuccess,
  type UpdateError,
  type DeleteSuccess,
  type DeleteError,
} from "@/app/api/rutinas/route";
import * as rutinasApi from "@/api/rutinas";
import { NivelDeDificultad } from "@prisma/client";

jest.mock("@/api/rutinas");
jest.mock("@/lib/db");

const mockRutinasApi = rutinasApi as jest.Mocked<typeof rutinasApi>;

/**
 * CRITICAL: Verify that GET, PUT, DELETE handlers are exported as Next.js route handlers
 * This prevents the bug where handlers exist but aren't connected to any HTTP method
 */
describe("src/app/api/rutinas/[id]/route.ts — Export Verification", () => {
  it("should export GET as a function", () => {
    expect(typeof roueteHandlers.GET).toBe("function");
  });

  it("should export PUT as a function", () => {
    expect(typeof roueteHandlers.PUT).toBe("function");
  });

  it("should export DELETE as a function", () => {
    expect(typeof roueteHandlers.DELETE).toBe("function");
  });
});

describe("GET /api/rutinas/[id] — Get single Rutina by ID", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with rutina on successful get by id", async () => {
    const mockRutina = {
      id: "rutina-1",
      nombre: "Full Body",
      objetivoPrincipal: "Fuerza",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: NivelDeDificultad.INTERMEDIO,
      descripcion: "Rutina completa",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRutinasApi.handleRutinaGet.mockResolvedValue(mockRutina);

    const result = await roueteHandlers.GET(
      {} as any,
      { params: Promise.resolve({ id: "rutina-1" }) }
    );

    const json = await result.json();
    expect(result.status).toBe(200);
    expect(json.id).toBe("rutina-1");
    expect(json.nombre).toBe("Full Body");
  });

  it("should return 404 when rutina not found", async () => {
    mockRutinasApi.handleRutinaGet.mockResolvedValue(null);

    const result = await roueteHandlers.GET(
      {} as any,
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(result.status).toBe(404);
  });
});

describe("PUT /api/rutinas/[id] — Update specific Rutina", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with updated rutina on successful update", async () => {
    const mockUpdated = {
      id: "rutina-1",
      nombre: "Full Body Plus",
      objetivoPrincipal: "Hipertrofia",
      frecuenciaSemanal: 4,
      duracionEstimada: 75,
      nivelDeDificultad: NivelDeDificultad.AVANZADO,
      descripcion: "Rutina mejorada",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRutinasApi.handleRutinaUpdate.mockResolvedValue(mockUpdated);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        nombre: "Full Body Plus",
        frecuenciaSemanal: 4,
      }),
    } as any;

    const result = await roueteHandlers.PUT(
      mockRequest,
      { params: Promise.resolve({ id: "rutina-1" }) }
    );

    expect(result.status).toBe(200);
    const json = await result.json();
    expect(json.nombre).toBe("Full Body Plus");
    expect(json.frecuenciaSemanal).toBe(4);
  });

  it("should return 404 on rutina not found", async () => {
    mockRutinasApi.handleRutinaUpdate.mockResolvedValue(null);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        nombre: "Updated",
      }),
    } as any;

    const result = await roueteHandlers.PUT(
      mockRequest,
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(result.status).toBe(404);
  });
});

describe("DELETE /api/rutinas/[id] — Delete specific Rutina", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 204 on successful delete", async () => {
    mockRutinasApi.handleRutinaDelete.mockResolvedValue(undefined);

    const result = await roueteHandlers.DELETE(
      {} as any,
      { params: Promise.resolve({ id: "rutina-1" }) }
    );

    expect(result.status).toBe(204);
  });

  it("should return 404 when rutina not found during delete", async () => {
    // handleRutinaDelete throws "NOT_FOUND" error which mapErrorToResponse maps to 404
    mockRutinasApi.handleRutinaDelete.mockRejectedValue(
      new Error("NOT_FOUND")
    );

    const result = await roueteHandlers.DELETE(
      {} as any,
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(result.status).toBe(404);
    const json = await result.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("should return 409 when delete is blocked by active socio assignment", async () => {
    // handleRutinaDelete throws error with DELETE_BLOCKED_ASSIGNED which maps to 409
    mockRutinasApi.handleRutinaDelete.mockRejectedValue(
      new Error("DELETE_BLOCKED_ASSIGNED: Rutina asignada activamente a 2 socio(s)")
    );

    const result = await roueteHandlers.DELETE(
      {} as any,
      { params: Promise.resolve({ id: "rutina-assigned" }) }
    );

    expect(result.status).toBe(409);
    const json = await result.json();
    expect(json.code).toBe("DELETE_BLOCKED");
    expect(json.message).toContain("2 socio(s)");
  });
});
