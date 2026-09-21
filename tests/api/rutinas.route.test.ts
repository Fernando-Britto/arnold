import {
  handleRutinaCreateRequest,
  handleRutinaListRequest,
  handleRutinaGetRequest,
  handleRutinaUpdateRequest,
  handleRutinaDeleteRequest,
  type CreateSuccess,
  type CreateError,
  type ListSuccess,
  type ListError,
  type GetSuccess,
  type GetError,
  type UpdateSuccess,
  type UpdateError,
  type DeleteSuccess,
  type DeleteError,
} from "@/app/api/rutinas/route";
import {
  handleRutinaCreate,
  handleRutinaList,
  handleRutinaGet,
  handleRutinaUpdate,
  handleRutinaDelete,
  type RutinaInput,
} from "@/api/rutinas";

jest.mock("@/api/rutinas");
jest.mock("@/lib/db");

/**
 * Type guards for discriminated union responses
 * These MUST match the exported type guards from route.ts
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

function isGetSuccess(result: any): result is GetSuccess {
  return "id" in result && !("status" in result) && !("code" in result);
}

function isGetError(result: any): result is GetError {
  return "code" in result && "status" in result;
}

function isUpdateSuccess(result: any): result is UpdateSuccess {
  return "id" in result && result.status === 200;
}

function isUpdateError(result: any): result is UpdateError {
  return "code" in result && "status" in result;
}

function isDeleteSuccess(result: any): result is DeleteSuccess {
  return "message" in result && result.status === 204;
}

function isDeleteError(result: any): result is DeleteError {
  return "code" in result && "status" in result;
}

/**
 * Integration tests for POST/GET /api/rutinas route
 *
 * Tests the route handler functions exported from route.ts
 * (handleRutinaCreateRequest, handleRutinaListRequest, etc.)
 * with real error scenarios and proper assertions.
 *
 * Spec: T-008 Rutina API Routes
 */

describe("POST /api/rutinas — Create Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 201 with rutina on successful create", async () => {
    const input: RutinaInput = {
      nombre: "Rutina Full Body",
      objetivoPrincipal: "Fuerza general",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "Intermedio",
      descripcion: "Rutina completa para principiantes",
    };

    const mockCreated = {
      id: "rut-new-1",
      nombre: "Rutina Full Body",
      objetivoPrincipal: "Fuerza general",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "INTERMEDIO",
      descripcion: "Rutina completa para principiantes",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleRutinaCreate as jest.Mock).mockResolvedValue(mockCreated);

    const result = await handleRutinaCreateRequest(input);

    expect(isCreateSuccess(result)).toBe(true);
    if (isCreateSuccess(result)) {
      expect(result.status).toBe(201);
      expect(result.id).toBe("rut-new-1");
      expect(result.nombre).toBe("Rutina Full Body");
      expect(result.frecuenciaSemanal).toBe(3);
    }
  });

  it("should return 400 VALIDATION_ERROR when frecuenciaSemanal is out of range (0)", async () => {
    const invalidInput = {
      nombre: "Rutina Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 0,
      duracionEstimada: 60,
      nivelDeDificultad: "Básico",
    };

    (handleRutinaCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: La frecuencia semanal debe estar entre 1 y 7")
    );

    const result = await handleRutinaCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("frecuencia");
      expect(result.message).toContain("1 y 7");
    }
  });

  it("should return 400 VALIDATION_ERROR when frecuenciaSemanal is out of range (8)", async () => {
    const invalidInput = {
      nombre: "Rutina Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 8,
      duracionEstimada: 60,
      nivelDeDificultad: "Básico",
    };

    (handleRutinaCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: La frecuencia semanal debe estar entre 1 y 7")
    );

    const result = await handleRutinaCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("entre 1 y 7");
    }
  });

  it("should return 400 VALIDATION_ERROR when duracionEstimada is non-positive (0)", async () => {
    const invalidInput = {
      nombre: "Rutina Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 3,
      duracionEstimada: 0,
      nivelDeDificultad: "Básico",
    };

    (handleRutinaCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: La duración estimada debe ser mayor a 0")
    );

    const result = await handleRutinaCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("duración");
      expect(result.message).toContain("mayor a 0");
    }
  });

  it("should return 400 VALIDATION_ERROR when duracionEstimada is negative", async () => {
    const invalidInput = {
      nombre: "Rutina Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 3,
      duracionEstimada: -30,
      nivelDeDificultad: "Básico",
    };

    (handleRutinaCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: La duración estimada debe ser mayor a 0")
    );

    const result = await handleRutinaCreateRequest(invalidInput);

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should create rutina with optional description", async () => {
    const input: RutinaInput = {
      nombre: "Rutina Lower Body",
      objetivoPrincipal: "Piernas",
      frecuenciaSemanal: 2,
      duracionEstimada: 45,
      nivelDeDificultad: "Avanzado",
      descripcion: "Enfoque en cuádriceps y glúteos",
    };

    const mockCreated = {
      id: "rut-complete-1",
      ...input,
      nivelDeDificultad: "AVANZADO",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleRutinaCreate as jest.Mock).mockResolvedValue(mockCreated);

    const result = await handleRutinaCreateRequest(input);

    expect(isCreateSuccess(result)).toBe(true);
    if (isCreateSuccess(result)) {
      expect(result.status).toBe(201);
      expect(result.descripcion).toBe("Enfoque en cuádriceps y glúteos");
      expect(result.id).toBe("rut-complete-1");
    }
  });

  it("should pass valid input to handleRutinaCreate", async () => {
    const input: RutinaInput = {
      nombre: "Rutina Push",
      objetivoPrincipal: "Empuje",
      frecuenciaSemanal: 1,
      duracionEstimada: 50,
      nivelDeDificultad: "Básico",
    };

    (handleRutinaCreate as jest.Mock).mockResolvedValue({
      id: "rut-1",
      ...input,
      nivelDeDificultad: "BASICO",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handleRutinaCreateRequest(input);

    expect(handleRutinaCreate).toHaveBeenCalledWith(input);
  });
});

describe("GET /api/rutinas — List Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with rutinas array on successful list", async () => {
    const mockRutinas = [
      {
        id: "rut-1",
        nombre: "Full Body",
        objetivoPrincipal: "Fuerza",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "INTERMEDIO",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "rut-2",
        nombre: "Upper Body",
        objetivoPrincipal: "Tronco",
        frecuenciaSemanal: 2,
        duracionEstimada: 45,
        nivelDeDificultad: "AVANZADO",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (handleRutinaList as jest.Mock).mockResolvedValue(mockRutinas);

    const result = await handleRutinaListRequest();

    expect(isListSuccess(result)).toBe(true);
    if (isListSuccess(result)) {
      expect(result.length).toBe(2);
      expect(result[0].nombre).toBe("Full Body");
      expect(result[1].nombre).toBe("Upper Body");
    }
  });

  it("should return empty array when no rutinas exist", async () => {
    (handleRutinaList as jest.Mock).mockResolvedValue([]);

    const result = await handleRutinaListRequest();

    expect(isListSuccess(result)).toBe(true);
    if (isListSuccess(result)) {
      expect(result.length).toBe(0);
    }
  });

  it("should return 500 SERVER_ERROR on database error", async () => {
    (handleRutinaList as jest.Mock).mockRejectedValue(new Error("Database connection timeout"));

    const result = await handleRutinaListRequest();

    expect(isListError(result)).toBe(true);
    if (isListError(result)) {
      expect(result.status).toBe(500);
      expect(result.code).toBe("SERVER_ERROR");
    }
  });
});

describe("POST /api/rutinas with EjercicioEnRutina rows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create rutina with ejercicios array", async () => {
    const input: RutinaInput & { ejercicios?: any[] } = {
      nombre: "Rutina con Ejercicios",
      objetivoPrincipal: "Entrenamiento completo",
      frecuenciaSemanal: 3,
      duracionEstimada: 75,
      nivelDeDificultad: "Intermedio",
      ejercicios: [
        {
          ejercicioId: "ej-1",
          series: 3,
          repeticiones: 10,
          descanso: 90,
          orden: 1,
        },
        {
          ejercicioId: "ej-2",
          series: 4,
          repeticiones: 8,
          descanso: 120,
          orden: 2,
        },
        {
          ejercicioId: "ej-3",
          series: 3,
          repeticiones: 12,
          descanso: 60,
          orden: 3,
        },
      ],
    };

    const mockCreated = {
      id: "rut-with-ej-1",
      nombre: "Rutina con Ejercicios",
      objetivoPrincipal: "Entrenamiento completo",
      frecuenciaSemanal: 3,
      duracionEstimada: 75,
      nivelDeDificultad: "INTERMEDIO",
      descripcion: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleRutinaCreate as jest.Mock).mockResolvedValue(mockCreated);

    const result = await handleRutinaCreateRequest(input);

    expect(isCreateSuccess(result)).toBe(true);
    if (isCreateSuccess(result)) {
      expect(result.status).toBe(201);
      expect(result.id).toBe("rut-with-ej-1");
      expect(result.nombre).toBe("Rutina con Ejercicios");
    }

    // Verify input was passed with ejercicios array
    expect(handleRutinaCreate).toHaveBeenCalledWith(input);
  });
});

describe("GET /api/rutinas/:id — Get Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with rutina on successful get", async () => {
    const mockRutina = {
      id: "rut-1",
      nombre: "Full Body",
      objetivoPrincipal: "Fuerza",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "INTERMEDIO",
      descripcion: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleRutinaGet as jest.Mock).mockResolvedValue(mockRutina);

    const result = await handleRutinaGetRequest("rut-1");

    expect(isGetSuccess(result)).toBe(true);
    if (isGetSuccess(result)) {
      expect(result.id).toBe("rut-1");
      expect(result.nombre).toBe("Full Body");
    }
  });

  it("should return 404 NOT_FOUND when rutina does not exist", async () => {
    (handleRutinaGet as jest.Mock).mockResolvedValue(null);

    const result = await handleRutinaGetRequest("nonexistent");

    expect(isGetError(result)).toBe(true);
    if (isGetError(result)) {
      expect(result.status).toBe(404);
      expect(result.code).toBe("NOT_FOUND");
      expect(result.message).toContain("Rutina");
    }
  });
});

describe("DELETE /api/rutinas/:id — Delete Handler with Cascade Guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 204 on successful delete", async () => {
    (handleRutinaDelete as jest.Mock).mockResolvedValue(undefined);

    const result = await handleRutinaDeleteRequest("rut-1");

    expect(isDeleteSuccess(result)).toBe(true);
    if (isDeleteSuccess(result)) {
      expect(result.status).toBe(204);
      expect(result.message).toContain("eliminada");
    }
  });

  it("should return 409 CONFLICT when rutina is assigned to active socio(s)", async () => {
    (handleRutinaDelete as jest.Mock).mockRejectedValue(
      new Error("DELETE_BLOCKED_ASSIGNED: Rutina asignada activamente a 2 socio(s)")
    );

    const result = await handleRutinaDeleteRequest("rut-assigned");

    expect(isDeleteError(result)).toBe(true);
    if (isDeleteError(result)) {
      expect(result.status).toBe(409);
      expect(result.code).toBe("DELETE_BLOCKED");
      expect(result.message).toContain("Rutina asignada");
      expect(result.message).toContain("2 socio(s)");
    }
  });

  it("should return 404 NOT_FOUND when rutina does not exist", async () => {
    (handleRutinaDelete as jest.Mock).mockRejectedValue(new Error("NOT_FOUND"));

    const result = await handleRutinaDeleteRequest("nonexistent");

    expect(isDeleteError(result)).toBe(true);
    if (isDeleteError(result)) {
      expect(result.status).toBe(404);
      expect(result.code).toBe("NOT_FOUND");
    }
  });
});

describe("Error mapping and response structure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should map validation error to 400 with clear message", async () => {
    (handleRutinaCreate as jest.Mock).mockRejectedValue(
      new Error("Validación fallida: El nombre es requerido")
    );

    const result = await handleRutinaCreateRequest({
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "Básico",
    });

    expect(isCreateError(result)).toBe(true);
    if (isCreateError(result)) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toBe("El nombre es requerido");
    }
  });

  it("should distinguish between success and error in create response", async () => {
    const mockRutina = {
      id: "rut-1",
      nombre: "Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
      descripcion: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (handleRutinaCreate as jest.Mock).mockResolvedValue(mockRutina);

    const result = await handleRutinaCreateRequest({
      nombre: "Test",
      objetivoPrincipal: "Test",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "Básico",
    });

    // Success: has status 201 and id
    expect("status" in result).toBe(true);
    expect("id" in result).toBe(true);
    expect((result as any).status).toBe(201);
  });

  it("should distinguish between success and error in list response", async () => {
    const mockRutinas = [{ id: "rut-1", nombre: "Test" }];

    (handleRutinaList as jest.Mock).mockResolvedValue(mockRutinas);

    const result = await handleRutinaListRequest();

    // Success: Array
    expect(Array.isArray(result)).toBe(true);

    // Error: Object with status and code
    (handleRutinaList as jest.Mock).mockRejectedValue(new Error("DB error"));
    const errorResult = await handleRutinaListRequest();
    expect("status" in errorResult).toBe(true);
    expect("code" in errorResult).toBe(true);
  });
});
