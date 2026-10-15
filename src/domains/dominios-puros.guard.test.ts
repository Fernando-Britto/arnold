import fs from "fs";
import path from "path";

/**
 * Guardián (refactor de arquitectura): `src/domains` es la capa de dominio. No puede tener un
 * edge ESTÁTICO con la infraestructura (`@/lib/db`), porque varios de sus módulos se importan
 * desde componentes del navegador y arrastrarían Prisma al bundle. El acceso a datos se inyecta
 * por parámetro y el default se carga con `await import("@/lib/db")` (diferido), como en
 * `configuracion.ts`, `oferta-reactivacion-consulta.ts`, `ejercicio-repositorio.ts` y
 * `rutina-repositorio.ts`. Este test falla ante cualquier `import ... from "@/lib/db"`.
 *
 * Mismo estilo que `src/lib/configuracion.guard.test.ts`: recorrido de archivos + escaneo de texto,
 * sin dependencias nuevas. Los `.test.` quedan afuera: no forman parte del grafo del navegador.
 */
const DOMINIOS = path.resolve(__dirname);

/**
 * Excepciones permitidas: archivos de `src/domains` que legítimamente pueden tener un import
 * ESTÁTICO de `@/lib/db`. Hoy NO hay ninguno. Si algún módulo lo necesitara, se agrega acá con
 * su motivo, para que la excepción quede visible y no silenciosa.
 */
const EXCEPCIONES = new Map<string, string>([]);

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
  });
}

/**
 * Un import ESTÁTICO: `import ... from "@/lib/db"` o `import "@/lib/db"`. Un
 * `await import("@/lib/db")` NO matchea (no lleva `from` ni es un import de sentencia).
 */
function tieneImportEstatico(contenido: string): boolean {
  return (
    /^\s*import\b[^\n]*from\s+["']@\/lib\/db["']/m.test(contenido) ||
    /^\s*import\s+["']@\/lib\/db["']/m.test(contenido)
  );
}

describe("dominios puros: sin import estático de Prisma", () => {
  it("ningún archivo de src/domains importa @/lib/db de forma estática", () => {
    const infractores = archivos(DOMINIOS)
      .filter((f) => !EXCEPCIONES.has(path.relative(DOMINIOS, f)))
      .filter((f) => tieneImportEstatico(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(DOMINIOS, f));
    expect(infractores).toEqual([]);
  });
});
