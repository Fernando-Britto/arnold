import { decideAccess, type SessionState } from "./access-decision";
import type { HttpMethod, UserRole } from "./authorization";

const d = (pathname: string, session: SessionState, method: HttpMethod = "GET") =>
  decideAccess({ pathname, method, session });

describe("decideAccess", () => {
  it.each(["/login", "/api/auth/login", "/api/auth/logout"])("%s es pública", (p) => {
    expect(d(p, "none", "POST")).toEqual({ type: "next" });
  });

  describe("sin sesión", () => {
    it("página → /login con from", () => {
      expect(d("/clientes", "none")).toEqual({ type: "redirect", to: "/login?from=%2Fclientes" });
    });
    it("raíz → /login sin from", () => {
      expect(d("/", "none")).toEqual({ type: "redirect", to: "/login" });
    });
    it("API → 401 UNAUTHENTICATED", () => {
      expect(d("/api/clientes", "none")).toMatchObject({ type: "json", status: 401, code: "UNAUTHENTICATED" });
    });
  });

  describe("token inválido", () => {
    it("API → 401 TOKEN_INVALID", () => {
      expect(d("/api/clientes", "invalid")).toMatchObject({ type: "json", status: 401, code: "TOKEN_INVALID" });
    });
    it("página → /login con from", () => {
      expect(d("/rutinas", "invalid")).toEqual({ type: "redirect", to: "/login?from=%2Frutinas" });
    });
  });

  describe("con sesión", () => {
    it.each<UserRole>(["SOCIO", "INSTRUCTOR", "RECEPCIONISTA", "ADMINISTRADOR"])("raíz pasa para %s", (rol) => {
      expect(d("/", { rol })).toEqual({ type: "next" });
    });
    it("permitido: Instructor en /rutinas, Recepcionista en /clientes, Socio en /home-socio", () => {
      expect(d("/rutinas", { rol: "INSTRUCTOR" })).toEqual({ type: "next" });
      expect(d("/clientes", { rol: "RECEPCIONISTA" })).toEqual({ type: "next" });
      expect(d("/home-socio", { rol: "SOCIO" })).toEqual({ type: "next" });
    });
    it("Administrador pasa en todo, con cualquier método", () => {
      expect(d("/membresias", { rol: "ADMINISTRADOR" })).toEqual({ type: "next" });
      expect(d("/api/clientes", { rol: "ADMINISTRADOR" }, "DELETE")).toEqual({ type: "next" });
    });
    it("página prohibida → redirect al home del rol", () => {
      expect(d("/clientes", { rol: "SOCIO" })).toEqual({ type: "redirect", to: "/home-socio" });
      expect(d("/membresias", { rol: "INSTRUCTOR" })).toEqual({ type: "redirect", to: "/home-interno" });
      expect(d("/ejercicios", { rol: "RECEPCIONISTA" })).toEqual({ type: "redirect", to: "/home-interno" });
    });
    it("API prohibida → 403 sin revelar roles", () => {
      const r = d("/api/clientes", { rol: "SOCIO" });
      expect(r).toMatchObject({ type: "json", status: 403, code: "FORBIDDEN" });
      expect((r as { message: string }).message).not.toMatch(/administrador|instructor|recepcionista|socio/i);
    });
    it("método no permitido → 403", () => {
      expect(d("/api/socios", { rol: "INSTRUCTOR" }, "DELETE")).toMatchObject({ status: 403 });
      expect(d("/api/pagos", { rol: "RECEPCIONISTA" }, "POST")).toEqual({ type: "next" });
    });
  });
});