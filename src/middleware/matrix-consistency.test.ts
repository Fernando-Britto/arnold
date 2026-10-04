import { Rol } from "@prisma/client";
import { ROLE_GATE_MATRIX, roleGatingMiddleware } from "./role-gating";
import { hasRouteAccess } from "@/lib/authorization";

const roles = Object.values(Rol);

describe("ROLE_GATE_MATRIX y hasRouteAccess deben coincidir", () => {
  const casos = Object.keys(ROLE_GATE_MATRIX).flatMap((route) =>
    roles.map((rol) => [route, rol] as const)
  );

  it.each(casos)("%s para %s", (route, rol) => {
    const viaMatriz = roleGatingMiddleware(
      { user: { id: "u", email: "e@e.e", nombre: "n", rol } },
      route
    );
    expect(hasRouteAccess(rol, route, "GET").allowed).toBe(viaMatriz);
  });
});

describe("las rutas reales de la app están definidas en la matriz", () => {
  it.each(["/home-socio", "/api/home-socio", "/api/home-interno", "/api/clientes"])(
    "%s",
    (route) => {
      expect(ROLE_GATE_MATRIX[route]).toBeDefined();
    }
  );
});