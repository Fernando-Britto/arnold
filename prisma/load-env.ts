import path from "path";
import { loadEnvConfig } from "@next/env";

/**
 * Carga los archivos .env igual que `npm run dev` (mismas reglas y prioridades: .env.local pisa a .env,
 * y nunca pisa una variable ya definida en la terminal). Los scripts de prisma/ (db:latency,
 * bench:home-interno) la llaman antes de leer `DATABASE_URL`: no deben depender de que Prisma cargue
 * el .env como efecto secundario de importarlo. `@next/env` es el cargador que usa Next y es el que
 * su documentación recomienda para scripts fuera del servidor.
 */
export function cargarEnv(dir: string = path.resolve(__dirname, "..")): void {
  loadEnvConfig(dir, true, { info: () => {}, error: console.error }, true);
}
