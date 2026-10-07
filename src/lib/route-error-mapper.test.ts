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
