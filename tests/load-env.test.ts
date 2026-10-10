/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";

const setNodeEnv = (v: string | undefined) =>
  v === undefined ? Reflect.deleteProperty(process.env, "NODE_ENV") : Object.defineProperty(process.env, "NODE_ENV", { value: v, configurable: true, writable: true });

/**
 * @next/env guarda una "foto" del entorno en la primera carga (y en Jest NODE_ENV=test ignora .env.local).
 * Cada llamada usa una copia nueva del módulo y NODE_ENV=development, como `ts-node` en la terminal.
 */
function cargarEnv(dir: string) {
  const original = process.env.NODE_ENV;
  setNodeEnv("development");
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../prisma/load-env").cargarEnv(dir);
    });
  } finally {
    setNodeEnv(original);
  }
}

describe("cargarEnv (scripts de diagnóstico fuera de Next)", () => {
  let dir: string;
  const CLAVE = "ARNOLD_TEST_DATABASE_URL";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "arnold-env-"));
    delete process.env[CLAVE];
  });
  afterEach(() => {
    delete process.env[CLAVE];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("carga el archivo .env del directorio (con comillas, como el de la raíz del proyecto)", () => {
    fs.writeFileSync(path.join(dir, ".env"), `${CLAVE}="postgresql://postgres:@db.ejemplo.supabase.co:5432/postgres"\n`);
    cargarEnv(dir);
    expect(process.env[CLAVE]).toBe("postgresql://postgres:@db.ejemplo.supabase.co:5432/postgres");
  });

  it("no pisa una variable que ya está definida en el entorno de la terminal", () => {
    fs.writeFileSync(path.join(dir, ".env"), `${CLAVE}="del-archivo"\n`);
    process.env[CLAVE] = "de-la-terminal";
    cargarEnv(dir);
    expect(process.env[CLAVE]).toBe("de-la-terminal");
  });

  it(".env.local tiene prioridad sobre .env, igual que en la aplicación", () => {
    fs.writeFileSync(path.join(dir, ".env"), `${CLAVE}="base"\n`);
    fs.writeFileSync(path.join(dir, ".env.local"), `${CLAVE}="local"\n`);
    cargarEnv(dir);
    expect(process.env[CLAVE]).toBe("local");
  });

  it("sin archivos .env no falla", () => {
    expect(() => cargarEnv(dir)).not.toThrow();
    expect(process.env[CLAVE]).toBeUndefined();
  });
});
