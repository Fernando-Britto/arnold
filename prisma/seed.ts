import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { runSeed } from "./seed-data";

/**
 * Runner del seed de desarrollo (P-08). Uso: `npm run seed`.
 * Variables: DATABASE_URL (obligatoria), SEED_PASSWORD (opcional; contraseña de todos los usuarios del seed).
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed no puede correr en producción");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (completá el archivo .env)");

  // Se muestra solo el host (nunca usuario ni contraseña) para ver a qué base se está escribiendo.
  console.log(`Sembrando datos de desarrollo en: ${new URL(url).host}`);

  const prisma = new PrismaClient();
  try {
    const { password, usuarios } = await runSeed(prisma, {
      hash: (plain) => bcryptjs.hash(plain, 10),
      password: process.env.SEED_PASSWORD || undefined,
    });
    console.log("\nListo. Usuarios (la misma contraseña para todos):");
    for (const u of usuarios) console.log(`  ${u.rol.padEnd(14)} ${u.email}`);
    console.log(`\nContraseña: ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed fallido:", error instanceof Error ? error.message : error);
  process.exit(1);
});
