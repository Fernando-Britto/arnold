/**
 * Integridad del catálogo de ejercicios generado (D-70, T-050b). Lee los JSON de `prisma/data`:
 * si alguien regenera el catálogo con una traducción faltante o un nombre repetido, esto falla.
 */
import fs from "fs";
import path from "path";
import { GRUPOS_MUSCULARES, validateEjercicio } from "@/domains/ejercicio/ejercicio";
import type { EjercicioDelCatalogo, Glosario } from "@/domains/ejercicio/catalogo";

const DATA = path.join(process.cwd(), "prisma", "data");
const leer = <T>(archivo: string): T => JSON.parse(fs.readFileSync(path.join(DATA, archivo), "utf-8")) as T;

const catalogo = leer<EjercicioDelCatalogo[]>("ejercicios-es.json");
const glosario = leer<Glosario>("glosario-ejercicios.json");
const nombres = leer<Record<string, string>>("nombres-ejercicios.json");

describe("catálogo de ejercicios en español (prisma/data)", () => {
  it("tiene los 1.324 ejercicios del dataset", () => {
    expect(catalogo).toHaveLength(1324);
  });

  it("no repite datasetId ni nombre (el nombre es lo que ve el socio)", () => {
    expect(new Set(catalogo.map((e) => e.datasetId)).size).toBe(catalogo.length);
    expect(new Set(catalogo.map((e) => e.nombre.toLowerCase())).size).toBe(catalogo.length);
  });

  it("todos los nombres cumplen la validación del dominio", () => {
    const invalidos = catalogo.filter(
      (e) => !validateEjercicio({ nombre: e.nombre, grupoMuscular: e.grupoMuscular }).valid
    );
    expect(invalidos.map((e) => e.datasetId)).toEqual([]);
  });

  it("todo grupo muscular pertenece a la lista canónica y los 8 grupos tienen ejercicios", () => {
    const usados = new Set(catalogo.map((e) => e.grupoMuscular));
    for (const g of usados) expect(GRUPOS_MUSCULARES).toContain(g);
    expect([...usados].sort()).toEqual([...GRUPOS_MUSCULARES].sort());
  });

  it("cada ejercicio tiene equipamiento, músculo objetivo, instrucciones y media", () => {
    for (const e of catalogo) {
      expect(e.equipamiento).toBeTruthy();
      expect(e.musculoObjetivo).toBeTruthy();
      expect(e.instrucciones.length).toBeGreaterThan(0);
      expect(e.mediaId).toMatch(/^\d{4}-[A-Za-z0-9]+$/);
    }
  });

  it("no quedó texto traducible sin traducir: nada en el glosario es igual a su clave en inglés", () => {
    const sinTraducir = [...Object.entries(glosario.equipamiento), ...Object.entries(glosario.musculos)].filter(
      ([en, es]) => en.trim().toLowerCase() === es.trim().toLowerCase()
    );
    expect(sinTraducir).toEqual([]);
  });

  it("hay una traducción de nombre por cada ejercicio y ninguna sobra", () => {
    expect(Object.keys(nombres).sort()).toEqual(catalogo.map((e) => e.datasetId).sort());
  });

  it("los nombres no traen restos de codificación rota ni de inglés evidente", () => {
    const sospechosos = catalogo.filter((e) => /[вÃ]|\b(dumbbell|barbell|cable)\b/i.test(e.nombre));
    expect(sospechosos.map((e) => e.nombre)).toEqual([]);
  });
});

describe("instrucciones en español rioplatense (prisma/data)", () => {
  /** Arranques de paso que no son un verbo en imperativo (gerundios, conjunciones, preposiciones). */
  const NO_VERBOS = new Set([
    "manteniendo", "mientras", "activando", "al", "cuando", "con", "una", "en", "usando", "para", "desde", "luego",
    "esta", "ahora", "después", "a", "presionando", "contrayendo", "deberías", "permite", "simultáneamente",
  ]);
  const primeraPalabra = (paso: string) => (paso.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/)?.[0] ?? "").toLowerCase();
  const pasos = catalogo.flatMap((e) => e.instrucciones.map((paso) => ({ id: e.datasetId, paso })));

  it("todo paso empieza con un imperativo de vos o con un arranque que no es verbo", () => {
    const sospechosos = pasos.filter(({ paso }) => {
      const w = primeraPalabra(paso);
      if (NO_VERBOS.has(w)) return false;
      if (/[áéíó]$/.test(w)) return false; // "Colocá", "Subí", "Hacé": voseo
      // con pronombre pegado el voseo NO lleva tilde ("Ponete", "Sentate", "Levantala"); el tuteo sí ("Siéntate")
      return !(/^[a-zñ]+(te|se|la|las|lo|los|le|les)$/.test(w) && !["ponte", "detente"].includes(w));
    });
    expect([...new Set(sospechosos.map(({ paso }) => primeraPalabra(paso)))]).toEqual([]);
  });

  it("no queda vocabulario de España que ya se convierte: suelo, esterilla, tumbado, balón", () => {
    const restos = pasos.filter(({ paso }) => /\b(suelos?|esterillas?|tumbad[oa]s?|tumb[aá]ndo(te|se)|bal[oó]n(es)?)\b/i.test(paso));
    expect(restos.map(({ id }) => id)).toEqual([]);
  });

  it("no queda ningún presente de tú de los verbos más usados en las instrucciones", () => {
    const tu = /\b(aprietas|mantienes|contraes|levantas|empujas|tiras|haces|llevas|comienzas|inhalas|giras|exhalas|balanceas|saltas|extiendes|avanzas|subes|presionas|elevas|estiras|regresas|sostienes|vuelves|agachas|reclinas|realizas|caminas|incorporas|encoges|inclinas|flexionas|lanzas|controlas|sueltas|deseas)\b/i;
    expect(pasos.filter(({ paso }) => tu.test(paso)).map(({ id }) => id)).toEqual([]);
  });

  it("los pasos ya están en voseo en los casos típicos (hay voseo, no solo ausencia de tuteo)", () => {
    const texto = pasos.map(({ paso }) => paso).join(" ");
    for (const voseo of ["Repetí", "Hacé", "Mantené", "Colocá", "Ponete", "Sentate", "Acostate", "Bajá"]) {
      expect(texto).toContain(voseo);
    }
    expect(texto).toContain("piso");
  });

  it("los nombres y el equipamiento usan 'pelota' y no 'balón'", () => {
    expect(catalogo.filter((e) => /bal[oó]n/i.test(`${e.nombre} ${e.equipamiento}`)).map((e) => e.datasetId)).toEqual([]);
    expect(Object.values(glosario.equipamiento).filter((v) => /bal[oó]n/i.test(v))).toEqual([]);
  });
});
