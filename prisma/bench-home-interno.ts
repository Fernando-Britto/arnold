import path from "path";
import { register } from "tsconfig-paths";
import { diagnoseBench, summarize } from "./db-latency-report";

// El código de la app usa el alias "@/..." (src/). ts-node no lo conoce: se registra acá, ANTES de importar la app.
register({ baseUrl: path.resolve(__dirname, ".."), paths: { "@/*": ["src/*"] } });

/**
 * Benchmark FUERA de Next (P-07). Uso: `npm run bench:home-interno`. Ejecuta el mismo armado de datos de
 * Home_Interno que usa `GET /api/home-interno` y la misma verificación de sesión que hace el proxy
 * (usuario + token revocado, en paralelo), sin servidor de desarrollo de por medio. Solo LEE: no escribe
 * nada. Sirve para separar lo que cuesta la base de lo que cuesta `npm run dev`.
 */
const CORRIDAS = 8;

const medir = async (fn: () => Promise<unknown>) => {
  const inicio = performance.now();
  await fn();
  return Math.round(performance.now() - inicio);
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (completá el archivo .env)");
  console.log(`Base: ${new URL(url).host}\n`);

  // Importación dinámica a propósito: tiene que ocurrir después de registrar los alias.
  const { prisma } = await import("../src/lib/db");
  const { buildHomeInternoPayload } = await import("../src/api/home-interno-data");

  try {
    // Referencia: una consulta sola con la conexión ya abierta (la primera abre esa conexión y no cuenta).
    await prisma.$queryRaw`select 1`;
    const seq: number[] = [];
    for (let i = 0; i < 5; i++) seq.push(await medir(() => prisma.$queryRaw`select 1`));
    const rtt = summarize(seq).mediana;

    const builder: number[] = [];
    for (let i = 0; i < CORRIDAS; i++) builder.push(await medir(() => buildHomeInternoPayload()));

    // Igual que el proxy: usuario por id y token por jti, en paralelo (ids inexistentes: solo importa el tiempo).
    const auth: number[] = [];
    for (let i = 0; i < CORRIDAS; i++) {
      auth.push(
        await medir(() =>
          Promise.all([
            prisma.usuario.findUnique({ where: { id: "bench-inexistente" } }),
            prisma.tokenRevocation.findUnique({ where: { jti: "bench-inexistente" }, select: { jti: true } }),
          ])
        )
      );
    }

    console.log(`Corridas del armado (ms): ${builder.join(", ")}`);
    console.log(`Corridas de la sesión (ms): ${auth.join(", ")}\n`);
    console.log(diagnoseBench({ rtt, builder, auth }).join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudo medir:", error instanceof Error ? error.message : error);
  process.exit(1);
});
