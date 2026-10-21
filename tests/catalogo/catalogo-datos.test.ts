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
