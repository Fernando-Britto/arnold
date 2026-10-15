import fs from "fs";
import path from "path";

/**
 * Guardián (ARQ-2): `src/domains/cliente/cliente.ts` llega al navegador vía `src/api/clientes.ts`,
 * que es importado por una página "use client". No puede tener un import ESTÁTICO de `@/lib/auth`
 * (bcryptjs, jsonwebtoken, node:crypto): arrastraría esas librerías de servidor al bundle.
 * El hash se carga con `await import("@/lib/auth")` dentro de un método del repositorio.
 */
describe("cliente.ts no arrastra infraestructura de servidor al bundle", () => {
  const fuente = fs.readFileSync(path.resolve(__dirname, "cliente.ts"), "utf8");

  it("no tiene un import estatico de @/lib/auth", () => {
    expect(fuente).not.toMatch(/^\s*import\b[^\n]*@\/lib\/auth/m);
  });

  it("carga @/lib/auth de forma diferida", () => {
    expect(fuente).toContain('await import("@/lib/auth")');
  });
});
