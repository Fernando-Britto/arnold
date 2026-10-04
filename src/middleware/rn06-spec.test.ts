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
  ["/api/home-interno", [A, I, R]],
  ["/api/home-socio", [A, S]],
];

describe.each(ESPERADO)("%s (GET)", (route, permitidos) => {
  it.each(Object.values(Rol))("%s", (rol) => {
    expect(hasRouteAccess(rol, route, "GET").allowed).toBe(permitidos.includes(rol));
  });
});