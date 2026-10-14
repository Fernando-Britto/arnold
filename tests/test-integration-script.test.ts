/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import type { SpawnSyncReturns } from "child_process";

// Prueba de regresión de `scripts/test-integration.mjs` (P-37 y P-38, cierre 4R).
// NO se importa ni se mockea el script: se corre tal como se envía, con `docker` y `npx`
// falsos inyectados en el PATH. Así se verifica el argv real sin Docker ni red.

const RAIZ = path.resolve(__dirname, "..");
const SCRIPT = "scripts/test-integration.mjs";

// Spec de contenedor que satisface todos los chequeos de `contenedorReutilizable` del script.
const SPEC_COINCIDE =
  '{"State":{"Running":true},"Config":{"Image":"postgres:17-alpine","Env":["POSTGRES_USER=arnold","POSTGRES_PASSWORD=arnold","POSTGRES_DB=arnold_test"]},"HostConfig":{"PortBindings":{"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"5433"}]}}}';

// Falso `docker`: registra su argv y sólo imprime en los dos casos que el script captura
// (`version` e `inspect -f`). El resto no debe ensuciar stdout/stderr.
const FAKE_DOCKER = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (process.env.FAKE_DOCKER_LOG) fs.appendFileSync(process.env.FAKE_DOCKER_LOG, args.join(" ") + "\\n");
const sub = args[0];
if (sub === "version") { process.stdout.write("29.8.2\\n"); process.exit(0); }
if (sub === "inspect") {
  if (args[1] === "-f") { process.stdout.write((process.env.FAKE_DOCKER_INSPECT_JSON || "{}") + "\\n"); process.exit(0); }
  process.exit(Number(process.env.FAKE_DOCKER_EXISTS ?? "0"));
}
process.exit(Number(sub === "exec" ? (process.env.FAKE_PG_READY ?? "0") : "0"));
`;

// Falso `npx`: reemplaza a `npx prisma migrate deploy` y `npx jest …`. Siempre éxito, sin salida.
const FAKE_NPX = `#!/usr/bin/env node
const fs = require("node:fs");
if (process.env.FAKE_NPX_LOG) fs.appendFileSync(process.env.FAKE_NPX_LOG, process.argv.slice(2).join(" ") + "\\n");
process.exit(0);
`;

let tmpDir: string;
let binDir: string;
let contador = 0;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "arnold-harness-"));
  binDir = path.join(tmpDir, "bin");
  fs.mkdirSync(binDir);
  const fakes: Array<[string, string]> = [
    ["docker", FAKE_DOCKER],
    ["npx", FAKE_NPX],
  ];
  for (const [nombre, contenido] of fakes) {
    const ruta = path.join(binDir, nombre);
    fs.writeFileSync(ruta, contenido);
    fs.chmodSync(ruta, 0o755);
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

type Corrida = { res: SpawnSyncReturns<string>; log: string[] };

/**
 * Corre el script con los falsos en el PATH. Las variables FAKE_* se inyectan SÓLO en el entorno
 * del hijo, así que no hay estado global que limpiar después.
 */
function correr(args: string[], spec: string): Corrida {
  const id = `${contador++}`;
  const dockerLog = path.join(tmpDir, `docker-${id}.log`);
  const npxLog = path.join(tmpDir, `npx-${id}.log`);
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PATH: [binDir, path.dirname(process.execPath), process.env.PATH ?? ""].join(path.delimiter),
      FAKE_DOCKER_LOG: dockerLog,
      FAKE_NPX_LOG: npxLog,
      FAKE_DOCKER_INSPECT_JSON: spec,
    },
    encoding: "utf8",
  });
  const log = fs.existsSync(dockerLog)
    ? fs.readFileSync(dockerLog, "utf8").split("\n").filter((linea) => linea.length > 0)
    : [];
  return { res, log };
}

// Sin esto, un fallo no dice nada sobre el argv que realmente usó el script.
const texto = (c: Corrida) =>
  `exit=${c.res.status}\n--- docker ---\n${c.log.join("\n")}\n--- stdout ---\n${c.res.stdout}\n--- stderr ---\n${c.res.stderr}`;

// Jest 30 ya no acepta un mensaje como segundo argumento de `expect`: se engancha el log al
// mensaje del error para que cualquier rojo sea diagnosticable.
function conDetalle(c: Corrida, cuerpo: () => void): void {
  try {
    cuerpo();
  } catch (error) {
    if (error instanceof Error) error.message += `\n\n${texto(c)}`;
    throw error;
  }
}

describe("test-integration.mjs (orquestador de integración, con docker/npx falsos)", () => {
  it("P-37: el gate de readiness chequea Postgres por TCP", () => {
    const c = correr([], SPEC_COINCIDE);
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      // P-37 (R3-docker-readiness-race): `pg_isready` SIN `-h` consulta el socket unix, y el
      // servidor temporal que la imagen levanta durante el initdb escucha SÓLO por ahí, mientras
      // TCP todavía no acepta conexiones. Si el gate no fuerza `-h 127.0.0.1`, da "listo" antes de
      // tiempo y `prisma migrate deploy` falla con connection refused. La única invocación de
      // `pg_isready` debe llevar el flag.
      const pg = c.log.filter((linea) => linea.includes("pg_isready"));
      expect(pg).toHaveLength(1);
      const linea = pg[0] ?? "";
      expect(linea).toContain("pg_isready");
      expect(linea).toContain("-h 127.0.0.1");
      expect(linea).toContain("-p 5432");
    });
  });

  it("crea el contenedor con el puerto, la base y la imagen esperados", () => {
    const c = correr([], SPEC_COINCIDE);
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      const run = c.log.find((linea) => linea.startsWith("run ")) ?? "";
      expect(run).toContain("-p 127.0.0.1:5433:5432");
      expect(run).toContain("POSTGRES_DB=arnold_test");
      expect(run).toContain("postgres:17-alpine");
    });
  });

  it("P-38: con --keep reutiliza un contenedor que coincide", () => {
    const c = correr(["--keep"], SPEC_COINCIDE);
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      expect(c.log.some((linea) => linea.startsWith("run "))).toBe(false);
      expect(c.res.stdout).toContain("Se reutiliza");
    });
  });

  it("P-38: con --keep NO reutiliza un contenedor que no coincide", () => {
    const specDistinto = SPEC_COINCIDE.replace("POSTGRES_DB=arnold_test", "POSTGRES_DB=OTRA_BASE");
    const c = correr(["--keep"], specDistinto);
    conDetalle(c, () => {
      // P-38 (R3-keep-reuse-unvalidated): antes del fix se reutilizaba cualquier contenedor cuyo
      // NOMBRE coincidiera, así que un contenedor viejo podía absorber la migración y los borrados
      // por test. Con la validación, un spec distinto obliga a recrear: primero `rm`, después `run`.
      const iRm = c.log.findIndex((linea) => linea.startsWith("rm "));
      const iRun = c.log.findIndex((linea) => linea.startsWith("run "));
      expect(iRm).toBeGreaterThanOrEqual(0);
      expect(iRun).toBeGreaterThan(iRm);
      expect(c.res.stdout + c.res.stderr).toContain("no coincide");
    });
  });
});
