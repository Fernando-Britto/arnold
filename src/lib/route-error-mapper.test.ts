import { mapErrorToResponse } from "./route-error-mapper";

describe("mapErrorToResponse — errores inesperados", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("devuelve 500 genérico sin filtrar el detalle al cliente", () => {
    const res = mapErrorToResponse(new Error("connection refused 10.0.0.1"));

    expect(res).toEqual({
      code: "SERVER_ERROR",
      message: "No se pudo procesar la solicitud",
      status: 500,
    });
  });

  it("loguea el error original en el servidor (incluye code y meta de Prisma)", () => {
    const prismaLike = Object.assign(new Error("Transaction already closed"), {
      code: "P2028",
      meta: { modelName: "Socio" },
    });

    mapErrorToResponse(prismaLike);

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0].join(" ");
    expect(logged).toContain("P2028");
    expect(logged).toContain("Transaction already closed");
    expect(logged).toContain("Socio");
  });

  it("loguea también valores que no son Error", () => {
    mapErrorToResponse("boom");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["VALIDATION_ERROR: nombre requerido", 400],
    ["VALIDATION_DUPLICATE_EMAIL: Email ya registrado", 400],
    ["NOT_FOUND", 404],
    ["FORBIDDEN: nope", 403],
  ])("no loguea errores esperados (%s)", (msg, status) => {
    expect(mapErrorToResponse(new Error(msg)).status).toBe(status);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("mapErrorToResponse — el mensaje no expone el prefijo CODE: al usuario (N2)", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("quita el prefijo DEACTIVATION_WARNING del mensaje del dominio", () => {
    const conCodigo = Object.assign(
      new Error("DEACTIVATION_WARNING: 3 socios tienen esta membresía asignada"),
      { code: "DEACTIVATION_WARNING" }
    );

    const res = mapErrorToResponse(conCodigo);

    expect(res).toEqual({
      code: "DEACTIVATION_WARNING",
      message: "3 socios tienen esta membresía asignada",
      status: 400,
    });
    expect(res.message).not.toMatch(/^[A-Z_]+:\s/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("quita el prefijo DELETE_BLOCKED_ASSIGNED del mensaje del dominio", () => {
    const conCodigo = Object.assign(
      new Error("DELETE_BLOCKED_ASSIGNED: No se puede eliminar: 2 socios asignados"),
      { code: "DELETE_BLOCKED_ASSIGNED" }
    );

    const res = mapErrorToResponse(conCodigo);

    expect(res).toEqual({
      code: "DELETE_BLOCKED_ASSIGNED",
      message: "No se puede eliminar: 2 socios asignados",
      status: 409,
    });
  });

  it("quita el prefijo DELETE_BLOCKED_REFERENCES del mensaje del dominio", () => {
    const conCodigo = Object.assign(new Error("DELETE_BLOCKED_REFERENCES: tiene historial"), {
      code: "DELETE_BLOCKED_REFERENCES",
    });

    const res = mapErrorToResponse(conCodigo);

    expect(res.code).toBe("DELETE_BLOCKED_REFERENCES");
    expect(res.message).toBe("tiene historial");
    expect(res.status).toBe(409);
  });
});

describe("mapErrorToResponse — conflicto de cierre de caja (CASH_CLOSE_CONFLICT)", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("mapea el prefijo CASH_CLOSE_CONFLICT a 409 con el mensaje del dominio", () => {
    const res = mapErrorToResponse(
      new Error("CASH_CLOSE_CONFLICT: Ya existe un cierre de caja para el turno")
    );

    expect(res).toEqual({
      code: "CASH_CLOSE_CONFLICT",
      message: "Ya existe un cierre de caja para el turno",
      status: 409,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("mapea el fallo de serialización de Prisma (P2034) a 409, no a 500", () => {
    const prismaLike = Object.assign(
      new Error("Transaction failed due to a write conflict or a deadlock. Please retry your transaction"),
      { code: "P2034" }
    );

    const res = mapErrorToResponse(prismaLike);

    expect(res.status).toBe(409);
    expect(res.code).toBe("CASH_CLOSE_CONFLICT");
    expect(spy).not.toHaveBeenCalled();
  });

  it("mapea un código explícito CASH_CLOSE_CONFLICT a 409", () => {
    const conCodigo = Object.assign(new Error("choque de cierre"), { code: "CASH_CLOSE_CONFLICT" });

    const res = mapErrorToResponse(conCodigo);

    expect(res.status).toBe(409);
    expect(res.code).toBe("CASH_CLOSE_CONFLICT");
  });
});

describe("mapErrorToResponse — pago duplicado (PAYMENT_ALREADY_REGISTERED)", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("mapea el prefijo PAYMENT_ALREADY_REGISTERED a 409 con el mensaje del dominio", () => {
    const res = mapErrorToResponse(
      new Error(
        "PAYMENT_ALREADY_REGISTERED: Ya existe una cuota para el período que se intenta pagar"
      )
    );

    expect(res).toEqual({
      code: "PAYMENT_ALREADY_REGISTERED",
      message: "Ya existe una cuota para el período que se intenta pagar",
      status: 409,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("mapea un código explícito PAYMENT_ALREADY_REGISTERED a 409", () => {
    const conCodigo = Object.assign(new Error("cuota duplicada"), {
      code: "PAYMENT_ALREADY_REGISTERED",
    });

    const res = mapErrorToResponse(conCodigo);

    expect(res.status).toBe(409);
    expect(res.code).toBe("PAYMENT_ALREADY_REGISTERED");
  });
});

describe("mapErrorToResponse — borrado bloqueado por referencias (DELETE_BLOCKED_REFERENCES)", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("mapea el prefijo DELETE_BLOCKED_REFERENCES a 409 con el mensaje del dominio", () => {
    const res = mapErrorToResponse(
      new Error(
        "DELETE_BLOCKED_REFERENCES: No se puede eliminar el cliente porque tiene historial (asistencias, sesiones, progreso, pagos o cuotas)"
      )
    );

    expect(res).toEqual({
      code: "DELETE_BLOCKED_REFERENCES",
      message:
        "No se puede eliminar el cliente porque tiene historial (asistencias, sesiones, progreso, pagos o cuotas)",
      status: 409,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("mapea un código explícito DELETE_BLOCKED_REFERENCES a 409", () => {
    const conCodigo = Object.assign(new Error("con historial"), {
      code: "DELETE_BLOCKED_REFERENCES",
    });

    const res = mapErrorToResponse(conCodigo);

    expect(res.status).toBe(409);
    expect(res.code).toBe("DELETE_BLOCKED_REFERENCES");
  });
});
