import fs from "fs";
import path from "path";

/**
 * Guardián (T-043a, D-54): `ConfiguracionDelSistema` se lee en un solo lugar, `src/lib/configuracion.ts`.
 * Si cada pantalla o API la leyera por su cuenta, volverían a aparecer criterios distintos
 * (con y sin orden, con valores por defecto repetidos). Los tests y el seed (fuera de `src`) quedan afuera.
 */
const SRC = path.resolve(__dirname, "..");
const PERMITIDO = path.join("lib", "configuracion.ts");

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
  });
}

describe("lector único de configuración", () => {
  it("solo src/lib/configuracion.ts menciona configuracionDelSistema", () => {
    const infractores = archivos(SRC)
      .filter((f) => !f.endsWith(PERMITIDO))
      .filter((f) => fs.readFileSync(f, "utf8").includes("configuracionDelSistema"))
      .map((f) => path.relative(SRC, f));
    expect(infractores).toEqual([]);
  });
});
