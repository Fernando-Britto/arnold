/**
 * Integration tests for GET/PUT/DELETE /api/ejercicios/[id]
 * Tests the route handlers and error mapping for individual ejercicio operations
 */

import {
  PUT as putEjercicio,
  DELETE as delEjercicio,
  handleEjercicioGetRequest,
  handleEjercicioUpdateRequest,
  handleEjercicioDeleteRequest,
} from "./route";
import {
  handleEjercicioGet,
  handleEjercicioUpdate,
  handleEjercicioDelete,
} from "@/api/ejercicios";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";

// Mock the API layer
jest.mock("@/api/ejercicios");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

// El console.error de route-error-mapper en el 500 es comportamiento correcto: se captura con
// spy por test y se afirma el mensaje. `restoreAllMocks` evita que el spy filtre a otros tests.
afterEach(() => {
  jest.restoreAllMocks();
});

const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;
const ctx = { params: Promise.resolve({ id: "e1" }) };
const jsonReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof putEjercicio>[0];

describe("Ejercicio [id] API Routes", () => {
  const mockEjercicio = {
    id: "1",
    nombre: "Press Militar",
    grupoMuscular: "Hombros",
    descripcion: "Empuje vertical con mancuernas",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/ejercicios/[id]", () => {
    it("should return single ejercicio by id", async () => {
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockResolvedValue(mockEjercicio);

      const result = await handleEjercicioGetRequest("1");

      expect((result as any).status).toBe(200);
      expect((result as any).id).toBe("1");
      expect((result as any).nombre).toBe("Press Militar");
    });

    it("should return 404 if ejercicio not found", async () => {
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockResolvedValue(null);

      const result = await handleEjercicioGetRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("should handle error from ejercicio get", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockRejectedValue(new Error("Database error"));

      const result = await handleEjercicioGetRequest("1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(500);
      }
      expect(errorSpy).toHaveBeenCalledWith(
        "[SERVER_ERROR]",
        expect.stringContaining("Database error"),
      );
    });
  });

  describe("PUT /api/ejercicios/[id]", () => {
    it("should update ejercicio successfully with valid data", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      const updated = {
        ...mockEjercicio,
        nombre: "Press Inclinado",
        grupoMuscular: "Pecho",
      };
      mockUpdate.mockResolvedValue(updated);

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "Press Inclinado",
        grupoMuscular: "Pecho",
      });

      expect((result as any).status).toBe(200);
      expect((result as any).nombre).toBe("Press Inclinado");
      expect((result as any).grupoMuscular).toBe("Pecho");
    });

    it("should reject if nombre is empty", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El nombre es requerido"),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "",
        grupoMuscular: "Hombros",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should reject if grupoMuscular is empty", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El grupo muscular es requerido"),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "Press Militar",
        grupoMuscular: "",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should return 404 if ejercicio not found", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockResolvedValue(null); // Repository returns null when not found

      const result = await handleEjercicioUpdateRequest("nonexistent", {
        nombre: "Updated",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("DELETE /api/ejercicios/[id]", () => {
     it("should delete ejercicio successfully", async () => {
       const mockDelete = handleEjercicioDelete as jest.MockedFunction<
         typeof handleEjercicioDelete
       >;
       mockDelete.mockResolvedValue(true);

       const result = await handleEjercicioDeleteRequest("1");

       expect((result as any).status).toBe(200);
       expect((result as any).message).toBe("Ejercicio eliminado");
     });

    it("should return 404 if ejercicio not found", async () => {
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockResolvedValue(false);

      const result = await handleEjercicioDeleteRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("should return 409 DELETE_BLOCKED_ASSIGNED when ejercicio is in use", async () => {
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockRejectedValue(
        Object.assign(
          new Error("DELETE_BLOCKED_ASSIGNED: No se puede eliminar el ejercicio porque está asignado a una o más rutinas"),
          { code: "DELETE_BLOCKED_ASSIGNED" }
        )
      );

      const result = await handleEjercicioDeleteRequest("ej-en-uso");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(409);
        expect(result.code).toBe("DELETE_BLOCKED_ASSIGNED");
      }
    });

    it("should handle error from ejercicio delete", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockRejectedValue(new Error("Database error"));

      const result = await handleEjercicioDeleteRequest("1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(500);
      }
      expect(errorSpy).toHaveBeenCalledWith(
        "[SERVER_ERROR]",
        expect.stringContaining("Database error"),
      );
    });
  });

  describe("PUT /api/ejercicios/[id] — malformed JSON body", () => {
    it("should return 400 (not 500) when the body is not valid JSON", async () => {
      const malformed = {
        json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token 'o'")),
      } as unknown as Parameters<typeof putEjercicio>[0];

      const res = await putEjercicio(malformed, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        code: "VALIDATION_ERROR",
        message: "El cuerpo de la solicitud no es JSON válido",
      });
      expect(handleEjercicioUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Auditoría de operaciones en /api/ejercicios/[id]", () => {
    beforeEach(() => jest.clearAllMocks());

    it("PUT exitoso registra MODIFICACION con responsableId y ejercicioId", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<typeof handleEjercicioUpdate>;
      mockUpdate.mockResolvedValueOnce({ id: "e1", nombre: "Press Inclinado" } as never);

      const res = await putEjercicio(jsonReq({ nombre: "Press Inclinado" }), ctx);

      expect(res.status).toBe(200);
      expect(mockAudit).toHaveBeenCalledWith({
        tipoOperacion: "MODIFICACION",
        responsableId: "u-admin",
        detalles: { ejercicioId: "e1" },
      });
    });

    it("PUT fallido no registra nada", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<typeof handleEjercicioUpdate>;
      mockUpdate.mockRejectedValueOnce(
        Object.assign(new Error("VALIDATION_ERROR: El nombre es requerido"), {
          code: "VALIDATION_ERROR",
        })
      );

      const res = await putEjercicio(jsonReq({ nombre: "" }), ctx);

      expect(res.status).toBe(400);
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("DELETE exitoso registra BAJA con responsableId y ejercicioId", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<typeof handleEjercicioDelete>;
      mockDelete.mockResolvedValueOnce(true);

      const res = await delEjercicio(jsonReq(undefined), ctx);

      expect(res.status).toBe(200);
      expect(mockAudit).toHaveBeenCalledWith({
        tipoOperacion: "BAJA",
        responsableId: "u-admin",
        detalles: { ejercicioId: "e1" },
      });
    });

    it("DELETE no encontrado no registra nada", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<typeof handleEjercicioDelete>;
      mockDelete.mockResolvedValueOnce(false);

      const res = await delEjercicio(jsonReq(undefined), ctx);

      expect(res.status).toBe(404);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });
});
