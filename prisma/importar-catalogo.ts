import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import type { EjercicioDelCatalogo } from "../src/domains/ejercicio/catalogo";
import { importarCatalogo, type ClienteImportador } from "./importar-catalogo-data";
import { cargarEnv } from "./load-env";

/**
 * Importa el catálogo de ejercicios (`prisma/data/ejercicios-es.json`) a la base (T-050c, D-70).
 * Uso: `npm run catalogo:importar [-- --dry-run] [-- --sobrescribir-nombres]`.
 *  - `--dry-run`: muestra qué haría sin escribir nada (conviene correrlo primero).
 *  - `--sobrescribir-nombres`: en ejercicios ya importados, vuelve a tomar nombre y grupo del
 *    catálogo (por defecto se respetan las ediciones del admin).
 * Es repetible: no duplica y no escribe lo que no cambió. No toca los ejercicios cargados a mano.
 * Variable: DATABASE_URL (obligatoria). A diferencia del seed, SÍ puede correr en producción:
 * el catálogo es dato real, no de prueba.
 */
async function main() {
  cargarEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (completá el archivo .env)");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sobrescribirNombres = args.includes("--sobrescribir-nombres");

  const catalogo = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "ejercicios-es.json"), "utf-8")
  ) as EjercicioDelCatalogo[];

  // Se muestra solo el host (nunca usuario ni contraseña) para ver a qué base se está escribiendo.
  console.log(`${dryRun ? "[dry-run] " : ""}Importando ${catalogo.length} ejercicios en: ${new URL(url).host}`);

  const prisma = new PrismaClient();
  try {
    // Cast: el PrismaClient generado cumple esta interfaz mínima (ver ClienteImportador).
    const r = await importarCatalogo(prisma as unknown as ClienteImportador, catalogo, { dryRun, sobrescribirNombres });
    console.log(`\n${r.dryRun ? "Haría" : "Hecho"}: ${r.creados} creados, ${r.actualizados} actualizados, ${r.sinCambios} sin cambios.`);
    if (r.conflictos.length > 0) {
      console.log(`\n${r.conflictos.length} ejercicios NO se importaron por conflicto de nombre:`);
      for (const c of r.conflictos) console.log(`  ${c.datasetId}  "${c.nombre}"  (choca con ${c.conId}): ${c.motivo}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Importación fallida:", error instanceof Error ? error.message : error);
  process.exit(1);
});
