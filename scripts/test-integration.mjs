#!/usr/bin/env node
// Orquestador de los tests de integración (P-25, D-52).
// Levanta un Postgres efímero en Docker, espera a que esté listo, aplica las migraciones
// reales, corre la suite de integración y baja el contenedor. Sin dependencias nuevas:
// sólo módulos de Node.
import { spawnSync } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";

const PUERTO = process.env.ARNOLD_TEST_DB_PORT ?? "5433";
const IMAGEN = process.env.ARNOLD_TEST_DB_IMAGE ?? "postgres:17-alpine";
const CONTENEDOR = process.env.ARNOLD_TEST_DB_CONTAINER ?? "arnold-test-db";
const USUARIO = "arnold";
const CLAVE = "arnold";
const BASE = "arnold_test";
const URL = `postgresql://${USUARIO}:${CLAVE}@127.0.0.1:${PUERTO}/${BASE}`;
const KEEP = process.argv.includes("--keep");
const TIMEOUT_MS = 60_000;

function docker(args, opciones = {}) {
  return spawnSync("docker", args, { stdio: "inherit", ...opciones });
}

function abortar(mensaje) {
  throw new Error(mensaje);
}

// Sin docker en el PATH (o con el daemon caído) no hay Postgres efímero posible.
function verificarDocker() {
  const version = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (version.error || version.status !== 0) {
    abortar(
      "No se encontró 'docker' en el PATH o el daemon no responde. Los tests de integración necesitan Docker."
    );
  }
}

function contenedorCorriendo() {
  const inspeccion = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTENEDOR], { encoding: "utf8" });
  return inspeccion.status === 0 && inspeccion.stdout.trim() === "true";
}

function prepararContenedor() {
  if (KEEP && contenedorCorriendo()) {
    console.log(`Se reutiliza el contenedor ${CONTENEDOR} (--keep).`);
    return;
  }

  // Normalmente no existe: el fallo del rm se ignora a propósito.
  docker(["rm", "-f", CONTENEDOR], { stdio: "ignore" });

  // NOTA: sin --tmpfs para PGDATA. El initdb de la imagen falla si el mount es de root.
  const inicio = docker([
    "run",
    "-d",
    "--rm",
    "--name",
    CONTENEDOR,
    "-e",
    `POSTGRES_USER=${USUARIO}`,
    "-e",
    `POSTGRES_PASSWORD=${CLAVE}`,
    "-e",
    `POSTGRES_DB=${BASE}`,
    "-p",
    `127.0.0.1:${PUERTO}:5432`,
    IMAGEN,
  ]);

  if (inicio.status !== 0) {
    abortar(`No se pudo iniciar el contenedor ${CONTENEDOR} con la imagen ${IMAGEN}.`);
  }
  console.log(`Contenedor ${CONTENEDOR} iniciado en 127.0.0.1:${PUERTO}.`);
}

async function esperarListo() {
  const limite = Date.now() + TIMEOUT_MS;
  while (Date.now() < limite) {
    const listo = spawnSync("docker", ["exec", CONTENEDOR, "pg_isready", "-U", USUARIO, "-d", BASE], {
      stdio: "ignore",
    });
    if (listo.status === 0) {
      console.log("Postgres listo.");
      return;
    }
    await esperar(500);
  }
  abortar(`Postgres no estuvo listo en 60 s. Revisá los logs con: docker logs ${CONTENEDOR}`);
}

function correr(comando, args, entornoExtra) {
  return spawnSync(comando, args, {
    stdio: "inherit",
    env: entornoExtra ? { ...process.env, ...entornoExtra } : process.env,
  });
}

async function main() {
  verificarDocker();
  prepararContenedor();

  try {
    await esperarListo();

    // Migraciones reales: nunca `db push`.
    const migracion = correr("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: URL });
    if (migracion.status !== 0) {
      abortar("Falló 'npx prisma migrate deploy'.");
    }

    const jest = correr("npx", ["jest", "--config", "jest.integration.config.ts", "--runInBand"], {
      DATABASE_URL: URL,
      ARNOLD_TEST_DATABASE_URL: URL,
    });
    return jest.status ?? 1;
  } finally {
    if (KEEP) {
      console.log(`Se deja el contenedor ${CONTENEDOR} corriendo (--keep).`);
    } else {
      docker(["rm", "-f", CONTENEDOR], { stdio: "ignore" });
    }
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
