import {
  handleEjercicioCreateRequest,
  handleEjercicioListRequest,
  type CreateSuccess,
  type CreateError,
  type ListSuccess,
  type ListError,
} from "@/app/api/ejercicios/route";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import {
  handleEjercicioCreate,
  handleEjercicioList,
} from "@/api/ejercicios";
import { EjercicioInput } from "@/domains/ejercicio/ejercicio";

jest.mock("@/api/ejercicios");
jest.mock("@/lib/db");

/**
 * Type guards for discriminated union responses
 */
function isCreateSuccess(result: any): result is CreateSuccess {
  return "id" in result && result.status === 201;
}

function isCreateError(result: any): result is CreateError {
  return "code" in result && "status" in result;
}

function isListSuccess(result: any): result is ListSuccess {
  return Array.isArray(result);
}

function isListError(result: any): result is ListError {
  return "code" in result && "status" in result;
}

/**
 * Integration tests for GET/POST /api/ejercicios route
 *
 * Tests the route handler functions exported from route.ts
 * (handleEjercicioCreateRequest, handleEjercicioListRequest)
 * with real error scenarios and proper assertions.
 *
 * Spec: ejercicios-crud/spec.md
 */

describe("POST /api/ejercicios — Create Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 201 with ejercicio on successful create", async () => {
    const input: EjercicioInput = {
      nombre: "Sentadilla",
      grupoMuscular: "Piernas",
      descripcion: "Ejercicio de piernas",
    };

    const mockCreated = {
      id: "ej-new-1",
      nombre: "Sentadilla",
      grupoMuscular: "Piernas",
      descripcion: "Ejercicio de piernas",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleEjercicioCreate as jest.Mock).mockResolvedValue(mockCreated);

    const result = await handleEjercicioCreateRequest(input);

    expect(isCreateSuccess(result)).toBe(true);
    if (isCreateSuccess(result)) {
      expect(result.status).toBe(201);
      expect(result.id).toBe("ej-new-1");
      expect(result.nombre).toBe("Sentadilla");
    }
  });

  it("should return 400 VALIDATION_ERROR when nombre is missing", async () => {
    const invalidInput = {
      grupoMuscular: "Piernas",
      // nombre missing
    };

    (handleEjercicioCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: El nombre es requerido")
    );

    const result = await handleEjercicioCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toBe("El nombre es requerido");
    }
  });

  it("should return 400 VALIDATION_ERROR when nombre is too short", async () => {
    const invalidInput = {
      nombre: "AB",
      grupoMuscular: "Pecho",
    };

    (handleEjercicioCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: El nombre debe tener al menos 3 caracteres")
    );

    const result = await handleEjercicioCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("3 caracteres");
    }
  });

  it("should return 400 VALIDATION_ERROR when grupoMuscular is missing", async () => {
    const invalidInput = {
      nombre: "Press Banco",
      // grupoMuscular missing
    };

    (handleEjercicioCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: El grupo muscular es requerido")
    );

    const result = await handleEjercicioCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("grupo muscular");
    }
  });

  it("should return 500 SERVER_ERROR on database error", async () => {
    const validInput: EjercicioInput = {
      nombre: "Curl",
      grupoMuscular: "Brazos",
    };

    (handleEjercicioCreate as jest.Mock).mockRejectedValue(
      new Error("Database connection timeout")
    );

    const result = await handleEjercicioCreateRequest(validInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(500);
      expect(result.code).toBe("SERVER_ERROR");
    }
  });

  it("should pass valid input to handleEjercicioCreate", async () => {
    const input: EjercicioInput = {
      nombre: "Flexiones",
      grupoMuscular: "Pecho",
    };

    (handleEjercicioCreate as jest.Mock).mockResolvedValue({
      id: "ej-1",
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handleEjercicioCreateRequest(input);

    expect(handleEjercicioCreate).toHaveBeenCalledWith(input);
  });

  it("should create ejercicio with optional description", async () => {
    const input: EjercicioInput = {
      nombre: "Press Banco",
      grupoMuscular: "Pecho",
      descripcion: "Ejercicio compuesto",
    };

    const mockCreated = {
      id: "ej-complete-1",
      nombre: "Press Banco",
      grupoMuscular: "Pecho",
      descripcion: "Ejercicio compuesto",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleEjercicioCreate as jest.Mock).mockResolvedValue(mockCreated);

    const result = await handleEjercicioCreateRequest(input);

    expect(isCreateSuccess(result)).toBe(true);
    if (isCreateSuccess(result)) {
      expect(result.status).toBe(201);
      expect(result.descripcion).toBe("Ejercicio compuesto");
      expect(result.id).toBe("ej-complete-1");
    }
  });
});

describe("GET /api/ejercicios — List Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with ejercicios array on successful list", async () => {
    const mockEjercicios = [
      {
        id: "ej-1",
        nombre: "Press Militar",
        grupoMuscular: "Hombros",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (handleEjercicioList as jest.Mock).mockResolvedValue(mockEjercicios);

    const result = await handleEjercicioListRequest();

    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result.length).toBe(1);
      expect(result[0].nombre).toBe("Press Militar");
    }
  });

  it("should return empty array when no ejercicios match", async () => {
    (handleEjercicioList as jest.Mock).mockResolvedValue([]);

    const result = await handleEjercicioListRequest({ search: "nonexistent" });

    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result.length).toBe(0);
    }
  });

  it("should return 500 SERVER_ERROR on database error", async () => {
    (handleEjercicioList as jest.Mock).mockRejectedValue(
      new Error("Database connection timeout")
    );

    const result = await handleEjercicioListRequest();

    expect(isListError(result)).toBe(true);
    if (isListError(result)) {
      expect(result.status).toBe(500);
      expect(result.code).toBe("SERVER_ERROR");
    }
  });

  it("should pass muscleGroup filter to handleEjercicioList", async () => {
    (handleEjercicioList as jest.Mock).mockResolvedValue([]);

    await handleEjercicioListRequest({ muscleGroup: "Pecho" });

    expect(handleEjercicioList).toHaveBeenCalledWith({ muscleGroup: "Pecho", search: undefined });
  });

  it("should pass search filter to handleEjercicioList", async () => {
    (handleEjercicioList as jest.Mock).mockResolvedValue([]);

    await handleEjercicioListRequest({ search: "press" });

    expect(handleEjercicioList).toHaveBeenCalledWith({ muscleGroup: undefined, search: "press" });
  });

  it("should pass both filters to handleEjercicioList", async () => {
    (handleEjercicioList as jest.Mock).mockResolvedValue([]);

    await handleEjercicioListRequest({
      muscleGroup: "Hombros",
      search: "militar",
    });

    expect(handleEjercicioList).toHaveBeenCalledWith({
      muscleGroup: "Hombros",
      search: "militar",
    });
  });

  it("should handle ejercicios with all fields", async () => {
    const mockEjercicios = [
      {
        id: "ej-complete-1",
        nombre: "Press Banco",
        grupoMuscular: "Pecho",
        descripcion: "Ejercicio compuesto",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (handleEjercicioList as jest.Mock).mockResolvedValue(mockEjercicios);

    const result = await handleEjercicioListRequest();

    expect(Array.isArray(result)).toBe(true);
    expect((result as any)[0].descripcion).toBe("Ejercicio compuesto");
    expect((result as any)[0].nombre).toBe("Press Banco");
  });
});

describe("Shared error mapping (mapErrorToResponse)", () => {
  it("should map validation error to 400 VALIDATION_ERROR", () => {
    const result = mapErrorToResponse(
      new Error("Validación fallida: El nombre es requerido")
    );

    expect(result.code).toBe("VALIDATION_ERROR");
    expect(result.status).toBe(400);
    expect(result.message).toBe("El nombre es requerido");
  });

  it("should map FORBIDDEN error to 403 with ejercicios custom message", () => {
    const result = mapErrorToResponse(new Error("FORBIDDEN: Rol requerido"), {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
    });

    expect(result.code).toBe("FORBIDDEN");
    expect(result.status).toBe(403);
    expect(result.message).toBe("Se requiere rol de administrador o instructor");
  });

  it("should map NOT_FOUND error to 404 with Ejercicio resource name", () => {
    const result = mapErrorToResponse(new Error("NOT_FOUND: Not found"), {
      resourceName: "Ejercicio",
    });

    expect(result.code).toBe("NOT_FOUND");
    expect(result.status).toBe(404);
    expect(result.message).toBe("Ejercicio no encontrado");
  });

  it("should map unhandled error to 500 SERVER_ERROR", () => {
    const result = mapErrorToResponse(new Error("Unexpected error"));

    expect(result.code).toBe("SERVER_ERROR");
    expect(result.status).toBe(500);
  });

  it("should handle non-Error objects", () => {
    const result = mapErrorToResponse("string error");

    expect(result.code).toBe("SERVER_ERROR");
    expect(result.status).toBe(500);
  });

  it("should use default forbidden message when not specified", () => {
    const result = mapErrorToResponse(new Error("FORBIDDEN: Something"));

    expect(result.message).toBe("Se requiere rol de administrador");
  });

  it("should use default resource name when not specified", () => {
    const result = mapErrorToResponse(new Error("NOT_FOUND: Something"));

    expect(result.message).toBe("Recurso no encontrado");
  });
});

describe("Route.ts wrappers (POST and GET functions)", () => {
  it("should distinguish between success (array) and error (object with status) in list", async () => {
    (handleEjercicioList as jest.Mock).mockResolvedValue([
      { id: "ej-1", nombre: "Test" },
    ]);

    const result = await handleEjercicioListRequest();

    // Success: Array
    expect(Array.isArray(result)).toBe(true);

    // Error: Object with status and code
    (handleEjercicioList as jest.Mock).mockRejectedValue(new Error("DB error"));
    const errorResult = await handleEjercicioListRequest();
    expect("status" in errorResult).toBe(true);
    expect("code" in errorResult).toBe(true);
  });

  it("should distinguish between success (object with id) and error (object with code) in create", async () => {
    const input: EjercicioInput = {
      nombre: "Test",
      grupoMuscular: "Test",
    };

    (handleEjercicioCreate as jest.Mock).mockResolvedValue({
      id: "ej-1",
      nombre: "Test",
      grupoMuscular: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handleEjercicioCreateRequest(input);

    // Success: has status 201 and id
    expect(result.status).toBe(201);
    expect("id" in result).toBe(true);

    // Error: has status and code
    (handleEjercicioCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: Error")
    );
    const errorResult = await handleEjercicioCreateRequest(input);
    expect("status" in errorResult).toBe(true);
    expect("code" in errorResult).toBe(true);
  });
});
