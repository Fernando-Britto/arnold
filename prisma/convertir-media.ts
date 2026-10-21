import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { EjercicioDelCatalogo } from "../src/domains/ejercicio/catalogo";
import { convertirMedia, type DepsMedia } from "./convertir-media-data";

const ejecutar = promisify(execFile);

/**
 * Convierte los GIF del dataset de ejercicios a mp4 + miniatura jpg en `public/ejercicios/`
 * (T-050d, D-70). Uso: `npm run media:convertir -- <carpeta del dataset> [--dry-run] [--forzar]`.
 * Lee `<dataset>/videos/*.gif` solo para los ejercicios del catálogo y es repetible: lo ya
 * convertido se omite. Requiere ffmpeg instalado (`sudo apt install ffmpeg`). No toca la base.
 * Solo se commitean los mp4 y jpg: los GIF están en .gitignore.
 */
async function main() {
  const carpeta = process.argv[2];
  if (!carpeta || carpeta.startsWith("--")) {
    throw new Error("Uso: npm run media:convertir -- <carpeta del dataset> [--dry-run] [--forzar]");
  }
  const args = process.argv.slice(3);

  try {
    await ejecutar("ffmpeg", ["-version"]);
  } catch {
    throw new Error("No se encontró ffmpeg. Instalalo (en Ubuntu/Debian: sudo apt install ffmpeg) y volvé a correr.");
  }

  const catalogo = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "ejercicios-es.json"), "utf-8")
  ) as EjercicioDelCatalogo[];

  const deps: DepsMedia = {
    existe: (ruta) => fs.existsSync(ruta),
    crearCarpeta: (ruta) => { fs.mkdirSync(ruta, { recursive: true }); },
    tamaño: (ruta) => (fs.existsSync(ruta) ? fs.statSync(ruta).size : 0),
    renombrar: (de, a) => fs.renameSync(de, a),
    borrar: (ruta) => fs.rmSync(ruta, { force: true }),
    ejecutar: async (comando, argumentos) => { await ejecutar(comando, argumentos); },
  };

  const r = await convertirMedia(deps, {
    origen: path.join(carpeta, "videos"),
    destino: path.resolve(__dirname, "..", "public", "ejercicios"),
    mediaIds: catalogo.map((e) => e.mediaId),
    dryRun: args.includes("--dry-run"),
    forzar: args.includes("--forzar"),
  });

  const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
  console.log(
    `${r.dryRun ? "Haría" : "Hecho"}: ${r.convertidos} ejercicios convertidos, ${r.omitidos} ya estaban.`
  );
  if (!r.dryRun) console.log(`GIF: ${mb(r.bytesOrigen)} MB → mp4 + jpg: ${mb(r.bytesDestino)} MB`);
}

main().catch((error) => {
  console.error("Conversión fallida:", error instanceof Error ? error.message : error);
  process.exit(1);
});
