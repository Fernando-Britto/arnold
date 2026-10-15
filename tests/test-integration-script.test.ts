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

// H2 (R3-no-subprocess-timeout): si el script se cuelga (por ejemplo en su poll de
// readiness), sin timeout el worker de Jest esperaría para siempre. Este límite convierte
// el cuelgue en un fallo rápido y legible.
const TIMEOUT_HIJO_MS = 20_000;

// H3 (R2-002): una sola fuente de verdad para el nombre de la base de prueba. El spec del
// contenedor se arma desde una plantilla, así que si este valor cambia cambian TODOS los
// specs juntos: un `.replace()` que quedara sin efecto ya no puede degenerar el test
// negativo en una copia del positivo de forma silenciosa.
const BASE_PRUEBA = "arnold_test";

// Spec de contenedor que satisface todos los chequeos de `contenedorReutilizable` del script.
// Se genera desde plantilla para que coincidente y no coincidente compartan estructura.
function specContenedor(base: string): string {
  return JSON.stringify({
    State: { Running: true },
    Config: {
      Image: "postgres:17-alpine",
      Env: [
        "POSTGRES_USER=arnold",
        "POSTGRES_PASSWORD=arnold",
        `POSTGRES_DB=${base}`,
      ],
    },
    HostConfig: {
      PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "5433" }] },
    },
  });
}

const SPEC_COINCIDE = specContenedor(BASE_PRUEBA);
// Sólo cambia la base: todo lo demás coincide, así el test negativo prueba exactamente que
// la validación mira la base y no sólo el nombre del contenedor.
const SPEC_DISTINTO = specContenedor("OTRA_BASE");

// Falso `docker`: registra su argv y sólo imprime en los dos casos que el script captura
// (`version` e `inspect -f`). El resto no debe ensuciar stdout/stderr.
//
// H4 (R2-001 + R3-readiness-retry-unproved): la rama `exec` es con estado. Lee
// `FAKE_PG_FAIL_TIMES` (cuántas sondas fallan antes de responder) y lleva la cuenta en el
// archivo `FAKE_PG_COUNTER`, que el runner ubica dentro del tmp por corrida. Mientras el
// contador esté por debajo del umbral sale con código 1; después responde con
// `FAKE_PG_READY`. Así se puede ejercitar de verdad el reintento del gate.
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
if (sub === "exec") {
  const fallas = Number(process.env.FAKE_PG_FAIL_TIMES ?? "0");
  const contador = process.env.FAKE_PG_COUNTER;
  let veces = 0;
  if (contador && fs.existsSync(contador)) veces = Number(fs.readFileSync(contador, "utf8")) || 0;
  if (contador) fs.writeFileSync(contador, String(veces + 1));
  if (veces < fallas) process.exit(1);
  process.exit(Number(process.env.FAKE_PG_READY ?? "0"));
}
process.exit(0);
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
  // H5 (R3-afterall-masks-setup): si `beforeAll` falla antes de asignar `tmpDir`, este
  // `afterAll` igual corre. Sin el guard, `fs.rmSync(undefined, …)` lanzaría un segundo
  // error que tapa el fallo real del setup.
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

type Corrida = { res: SpawnSyncReturns<string>; log: string[] };

// Knobs del fake que el runner puede mover explícitamente (H4). Todo lo demás queda en su
// valor por defecto fijo.
type OpcionesCorrida = {
  /** Cuántas sondas de `pg_isready` fallan antes de responder (default: 0). */
  pgFailTimes?: string;
  /** Código de salida de `pg_isready` cuando responde (default: 0 = listo). */
  pgReady?: string;
  /** Código de salida de `docker inspect <contenedor>` (default: 0 = existe). */
  dockerExists?: string;
};

/**
 * Corre el script con los falsos en el PATH.
 *
 * H1 (R3-env-hermeticity): las variables FAKE_* se inyectan SÓLO en el entorno del hijo y
 * TODAS quedan fijadas con valor explícito. Antes el entorno se armaba con
 * `{ ...process.env, ... }` fijando sólo algunas FAKE_*: cualquier otra heredada del shell
 * (p. ej. `FAKE_PG_FAIL_TIMES=99`) cambiaba en silencio el comportamiento del fake.
 */
function correr(args: string[], spec: string, opciones: OpcionesCorrida = {}): Corrida {
  const id = `${contador++}`;
  const dockerLog = path.join(tmpDir, `docker-${id}.log`);
  const npxLog = path.join(tmpDir, `npx-${id}.log`);
  // El contador de sondas vive dentro del tmp por corrida: ninguna corrida comparte estado.
  const pgCounter = path.join(tmpDir, `pg-counter-${id}`);
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PATH: [binDir, path.dirname(process.execPath), process.env.PATH ?? ""].join(path.delimiter),
      FAKE_DOCKER_LOG: dockerLog,
      FAKE_NPX_LOG: npxLog,
      FAKE_DOCKER_INSPECT_JSON: spec,
      FAKE_DOCKER_EXISTS: opciones.dockerExists ?? "0",
      FAKE_PG_READY: opciones.pgReady ?? "0",
      FAKE_PG_FAIL_TIMES: opciones.pgFailTimes ?? "0",
      FAKE_PG_COUNTER: pgCounter,
    },
    encoding: "utf8",
    timeout: TIMEOUT_HIJO_MS,
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
  // H2: si el hijo fue matado por el timeout de `spawnSync`, `status` es null y la aserción
  // fallaría con un mensaje confuso. Acá se traduce a un error explícito.
  const error = c.res.error as NodeJS.ErrnoException | undefined;
  if (error?.code === "ETIMEDOUT" || c.res.signal) {
    throw new Error(
      `El script no terminó dentro de ${TIMEOUT_HIJO_MS} ms (señal ${c.res.signal ?? "ninguna"}). ` +
        `Probable cuelgue del script (p. ej. el poll de readiness).\n\n${texto(c)}`
    );
  }
  try {
    cuerpo();
  } catch (err) {
    if (err instanceof Error) err.message += `\n\n${texto(c)}`;
    throw err;
  }
}

// Restaura una variable del entorno padre respetando su estado original (seteada o ausente).
function restaurarEnv(clave: string, valor: string | undefined): void {
  if (valor === undefined) delete process.env[clave];
  else process.env[clave] = valor;
}

describe("test-integration.mjs (orquestador de integración, con docker/npx falsos)", () => {
  it("P-37: el gate de readiness chequea Postgres por TCP", () => {
    const c = correr([], SPEC_COINCIDE);
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      // P-37 (R3-docker-readiness-race): `pg_isready` SIN `-h` consulta el socket unix, y el
      // servidor temporal que la imagen levanta durante el initdb escucha SÓLO por ahí, mientras
      // TCP todavía no acepta conexiones. Si el gate no fuerza `-h 127.0.0.1`, da "listo" antes de
      // tiempo y `prisma migrate deploy` falla con connection refused. TODA invocación de
      // `pg_isready` debe llevar el flag (no basta con que exista una).
      const pg = c.log.filter((linea) => linea.includes("pg_isready"));
      expect(pg).toHaveLength(1);
      for (const linea of pg) {
        expect(linea).toContain("-h 127.0.0.1");
        expect(linea).toContain("-p 5432");
      }
    });
  });

  it("reintenta el gate de readiness hasta que Postgres responde (P-37)", () => {
    // H4 (R3-readiness-retry-unproved): el fake falla las 2 primeras sondas y recién la 3ª
    // responde. Prueba el reintento real —el comportamiento que el flag TCP existe para
    // proteger— y que el script igual termina en 0.
    const c = correr([], SPEC_COINCIDE, { pgFailTimes: "2" });
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      const pg = c.log.filter((linea) => linea.includes("pg_isready"));
      // Más de una sonda: el gate efectivamente reintentó en vez de rendirse o de dar listo.
      expect(pg.length).toBeGreaterThan(1);
      // Y cada reintento sigue chequeando por TCP explícito.
      for (const linea of pg) {
        expect(linea).toContain("-h 127.0.0.1");
        expect(linea).toContain("-p 5432");
      }
    });
  });

  it("crea el contenedor con el puerto, la base y la imagen esperados", () => {
    const c = correr([], SPEC_COINCIDE);
    conDetalle(c, () => {
      expect(c.res.status).toBe(0);

      const run = c.log.find((linea) => linea.startsWith("run ")) ?? "";
      expect(run).toContain("-p 127.0.0.1:5433:5432");
      expect(run).toContain(`POSTGRES_DB=${BASE_PRUEBA}`);
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
    const c = correr(["--keep"], SPEC_DISTINTO);
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

  it("es hermético: las FAKE_* del shell padre no cambian el resultado", () => {
    // Este test prueba la aceptación #5. Existe porque `correr` arma el entorno del hijo con
    // `{ ...process.env, ... }`: si no fijara TODAS las FAKE_*, una variable heredada del
    // shell padre (p. ej. FAKE_PG_FAIL_TIMES=99, que haría fallar el gate, o
    // FAKE_DOCKER_EXISTS=1, que haría creer que el contenedor existe) cambiaría el resultado.
    // Fijándolas explícitamente, el resultado debe ser idéntico al de un entorno limpio.
    const originalFail = process.env.FAKE_PG_FAIL_TIMES;
    const originalExists = process.env.FAKE_DOCKER_EXISTS;
    try {
      process.env.FAKE_PG_FAIL_TIMES = "99";
      process.env.FAKE_DOCKER_EXISTS = "1";

      const c = correr([], SPEC_COINCIDE);
      conDetalle(c, () => {
        expect(c.res.status).toBe(0);
        // Con las FAKE_* fijadas, el gate responde en la primera sonda igual que sin poison.
        const pg = c.log.filter((linea) => linea.includes("pg_isready"));
        expect(pg).toHaveLength(1);
      });
    } finally {
      // Restaura el entorno padre pase lo que pase.
      restaurarEnv("FAKE_PG_FAIL_TIMES", originalFail);
      restaurarEnv("FAKE_DOCKER_EXISTS", originalExists);
    }
  });
});
