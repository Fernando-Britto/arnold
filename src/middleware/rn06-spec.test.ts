import { Rol } from "@prisma/client";
import { hasRouteAccess } from "@/lib/authorization";

const A = Rol.ADMINISTRADOR, I = Rol.INSTRUCTOR, R = Rol.RECEPCIONISTA, S = Rol.SOCIO;

// Fuente: RN-06 en los specs de ejercicios, rutinas, clientes, membresías y home-interno.
// El Administrador pasa en todo por el comodín de authorization.ts.
const ESPERADO: Array<[string, Rol[]]> = [
  ["/ejercicios", [A, I]],
  ["/rutinas", [A, I]],
  ["/clientes", [A, R]],
  ["/membresias", [A]],
  ["/home-interno", [A, I, R]],
  ["/home-socio", [A, S]],
  ["/api/ejercicios", [A, I]],
  ["/api/rutinas", [A, I]],
  ["/api/clientes", [A, R]],
  ["/api/membresias", [A]],
  // Lectura mínima del dropdown de Clientes (AC-004): Recepcionista necesita las activas, nada más de Membresías.
  ["/api/membresias/activas", [A, R]],
  ["/api/home-interno", [A, I, R]],
  ["/api/home-socio", [A, S]],
];

describe.each(ESPERADO)("%s (GET)", (route, permitidos) => {
  it.each(Object.values(Rol))("%s", (rol) => {
    expect(hasRouteAccess(rol, route, "GET").allowed).toBe(permitidos.includes(rol));
  });
});

describe("Recepcionista y Membresías: solo el dropdown, nunca la gestión", () => {
  it.each([
    ["GET", "/membresias"],
    ["GET", "/api/membresias"],
    ["POST", "/api/membresias"],
    ["PUT", "/api/membresias/m1"],
    ["DELETE", "/api/membresias/m1"],
    ["POST", "/api/membresias/activas"],
    ["DELETE", "/api/membresias/activas"],
  ] as const)("%s %s sigue prohibido", (method, route) => {
    expect(hasRouteAccess(R, route, method).allowed).toBe(false);
  });

  it("Instructor y Socio no leen el dropdown (no es su pantalla)", () => {
    expect(hasRouteAccess(I, "/api/membresias/activas", "GET").allowed).toBe(false);
    expect(hasRouteAccess(S, "/api/membresias/activas", "GET").allowed).toBe(false);
  });
});

describe("Socio: sin accesos fantasma a /api/socios ni /api/pagos (B1)", () => {
  it("no pasa por /api/socios: su propia data sale de /api/home-socio", () => {
    expect(hasRouteAccess(S, "/api/socios", "GET").allowed).toBe(false);
    expect(hasRouteAccess(S, "/api/home-socio", "GET").allowed).toBe(true);
  });

  it("no pasa por /api/pagos: sus pagos salen de /api/home-socio", () => {
    expect(hasRouteAccess(S, "/api/pagos", "GET").allowed).toBe(false);
    expect(hasRouteAccess(S, "/api/home-socio", "GET").allowed).toBe(true);
  });
});
