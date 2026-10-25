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

describe("máquinas es solo de Administrador", () => {
  it.each([
    ["/maquinas", Rol.RECEPCIONISTA],
    ["/maquinas", Rol.INSTRUCTOR],
    ["/maquinas", Rol.SOCIO],
    ["/api/maquinas", Rol.RECEPCIONISTA],
    ["/api/maquinas", Rol.INSTRUCTOR],
    ["/api/maquinas", Rol.SOCIO],
  ] as const)("deniega %s a %s en ambas matrices", (route, rol) => {
    const viaMatriz = roleGatingMiddleware(
      { user: { id: "u", email: "e@e.e", nombre: "n", rol } },
      route
    );
    expect(viaMatriz).toBe(false);
    expect(hasRouteAccess(rol, route, "GET").allowed).toBe(false);
  });

  it.each(["/maquinas", "/api/maquinas"] as const)("permite ADMIN en %s en ambas matrices", (route) => {
    const viaMatriz = roleGatingMiddleware(
      { user: { id: "u", email: "e@e.e", nombre: "n", rol: Rol.ADMINISTRADOR } },
      route
    );
    expect(viaMatriz).toBe(true);
    expect(hasRouteAccess(Rol.ADMINISTRADOR, route, "GET").allowed).toBe(true);
  });
});
describe("el path anidado de ejercicios hereda el prefijo de máquinas", () => {
  it.each([
    [Rol.RECEPCIONISTA, "GET", false],
    [Rol.RECEPCIONISTA, "PUT", false],
    [Rol.INSTRUCTOR, "GET", false],
    [Rol.INSTRUCTOR, "PUT", false],
    [Rol.SOCIO, "GET", false],
    [Rol.SOCIO, "PUT", false],
    [Rol.ADMINISTRADOR, "GET", true],
    [Rol.ADMINISTRADOR, "PUT", true],
  ] as const)("%s en %s → allowed %s", (rol, metodo, esperado) => {
    expect(
      hasRouteAccess(rol, "/api/maquinas/1/ejercicios", metodo).allowed
    ).toBe(esperado);
  });
});
