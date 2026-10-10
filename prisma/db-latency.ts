import { PrismaClient } from "@prisma/client";
import { diagnose } from "./db-latency-report";

/**
 * Diagnóstico de latencia a la base (P-07). Uso: `npm run db:latency`. Solo hace `select 1`:
 * no lee ni escribe datos. Mide (1) la primera consulta con conexión en frío, (2) 10 consultas una
 * tras otra (ida y vuelta de red) y (3) 14 consultas a la vez, 5 veces (¿el pool las atiende juntas?).
 */
const medir = async (fn: () => Promise<unknown>) => {
  const inicio = performance.now();
  await fn();
  return Math.round(performance.now() - inicio);
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (completá el archivo .env)");
  // Solo el host y los parámetros de conexión (nunca usuario ni contraseña)
  const u = new URL(url);
  console.log(`Base: ${u.host}  parámetros: ${[...u.searchParams].map(([k, v]) => `${k}=${v}`).join(", ") || "(ninguno)"}\n`);

  const prisma = new PrismaClient();
  try {
    const frio = await medir(() => prisma.$queryRaw`select 1`);
    const seq: number[] = [];
    for (let i = 0; i < 10; i++) seq.push(await medir(() => prisma.$queryRaw`select 1`));
    const par: number[] = [];
    for (let i = 0; i < 5; i++) {
      par.push(await medir(() => Promise.all(Array.from({ length: 14 }, () => prisma.$queryRaw`select 1`))));
    }
    console.log(diagnose({ frio, seq, par }).join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudo medir:", error instanceof Error ? error.message : error);
  process.exit(1);
});
