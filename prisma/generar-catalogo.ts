import fs from "fs";
import path from "path";
import {
  construirEjercicioDelCatalogo,
  type EjercicioDelCatalogo,
  type EjercicioDelDataset,
  type Glosario,
} from "../src/domains/ejercicio/catalogo";

/**
 * Genera `prisma/data/ejercicios-es.json` a partir del dataset `hasaneyldrm/exercises-dataset`
 * (D-70, T-050b). Uso: `npm run catalogo:generar -- <carpeta del dataset>`.
 * Combina `data/exercises.json` del dataset con `nombres-ejercicios.json` y
 * `glosario-ejercicios.json`. Falla si falta una traducción o si dos ejercicios quedan con el
 * mismo nombre. Solo lee el dataset y escribe un archivo; no toca la base.
 */
function main() {
  const carpeta = process.argv[2];
  if (!carpeta) throw new Error("Uso: npm run catalogo:generar -- <carpeta del dataset>");

  const dataDir = path.join(__dirname, "data");
  const leer = <T>(ruta: string): T => JSON.parse(fs.readFileSync(ruta, "utf-8")) as T;

  const crudos = leer<EjercicioDelDataset[]>(path.join(carpeta, "data", "exercises.json"));
  const nombres = leer<Record<string, string>>(path.join(dataDir, "nombres-ejercicios.json"));
  const glosario = leer<Glosario>(path.join(dataDir, "glosario-ejercicios.json"));

  const catalogo: EjercicioDelCatalogo[] = crudos.map((c) => construirEjercicioDelCatalogo(c, nombres, glosario));

  const vistos = new Map<string, string>();
  for (const e of catalogo) {
    const clave = e.nombre.toLowerCase();
    const previo = vistos.get(clave);
    if (previo) throw new Error(`Nombre repetido "${e.nombre}" en los ejercicios ${previo} y ${e.datasetId}`);
    vistos.set(clave, e.datasetId);
  }

  fs.writeFileSync(path.join(dataDir, "ejercicios-es.json"), JSON.stringify(catalogo, null, 1) + "\n", "utf-8");
  console.log(`Catálogo generado: ${catalogo.length} ejercicios en prisma/data/ejercicios-es.json`);
}

main();
