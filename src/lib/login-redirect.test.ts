import { safeRedirectTarget, postLoginRoute } from "./login-redirect";

describe("safeRedirectTarget (P-09)", () => {
  it.each(["/clientes", "/home-socio", "/api/x?a=1", "/rutinas/7"])(
    "acepta una ruta relativa same-origin: %s",
    (p) => expect(safeRedirectTarget(p)).toBe(p)
  );

  it.each([
    null,
    undefined,
    "",
    "clientes",
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/a\\b",
    "/linea\nLocation",
  ])("rechaza %j", (p) => expect(safeRedirectTarget(p as string | null | undefined)).toBeNull());
});

describe("postLoginRoute (P-09)", () => {
  it("usa el from relativo cuando es seguro", () => {
    expect(postLoginRoute("/clientes", "SOCIO")).toBe("/clientes");
  });

  it("ignora un from absoluto y cae al home del rol", () => {
    expect(postLoginRoute("https://evil.example", "SOCIO")).toBe("/home-socio");
  });

  it("ignora un from protocol-relative y cae al home del rol", () => {
    expect(postLoginRoute("//evil.example", "INSTRUCTOR")).toBe("/home-interno");
  });

  it("sin from usa el home del rol", () => {
    expect(postLoginRoute(null, "ADMINISTRADOR")).toBe("/home-interno");
  });
});
