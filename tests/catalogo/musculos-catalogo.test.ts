/**
 * Los músculos del catálogo real se resuelven todos (T-051, D-71). Lee `prisma/data/ejercicios-es.json`:
 * si alguien regenera el catálogo con un término de músculo nuevo, esto falla en lugar de que el volumen
 * por músculo salga mal sin que nadie se entere.
 */
import fs from "fs";
import path from "path";
import type { EjercicioDelCatalogo } from "@/domains/ejercicio/catalogo";
import { MUSCULOS, musculoDesdeTermino, pesosDeMusculos } from "@/domains/ejercicio/musculos";

const catalogo = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "prisma", "data", "ejercicios-es.json"), "utf-8")
) as EjercicioDelCatalogo[];

const terminos = new Set<string>();
for (const e of catalogo) {
  terminos.add(e.musculoObjetivo);
  for (const m of e.musculosSecundarios) terminos.add(m);
}

describe("músculos del catálogo de 1.324 ejercicios", () => {
  it("hay 47 términos distintos y todos se resuelven (a un músculo, o a null si no se dibuja)", () => {
    expect(terminos.size).toBe(47);
    for (const t of terminos) expect(() => musculoDesdeTermino(t)).not.toThrow();
  });

  it("lo único que no se dibuja es lo esperable: manos, pies, tobillos, cuello y el sistema cardiovascular", () => {
    const sinDibujo = [...terminos].filter((t) => musculoDesdeTermino(t) === null).sort();

    expect(sinDibujo).toEqual([
      "Estabilizadores del tobillo",
      "Esternocleidomastoideo",
      "Manos",
      "Pies",
      "Sistema cardiovascular",
      "Tobillos",
    ]);
  });

  it("todo ejercicio que no es de cardio entrena al menos un músculo, con el objetivo pesando 1", () => {
    const sinMusculo: string[] = [];
    for (const e of catalogo.filter((x) => x.grupoMuscular !== "Cardio")) {
      const pesos = pesosDeMusculos(e);
      if (Math.max(0, ...Object.values(pesos)) !== 1) sinMusculo.push(`${e.datasetId} ${e.nombre}`);
    }

    expect(sinMusculo).toEqual([]);
  });

  it("el cardio no entrena ningún músculo", () => {
    for (const e of catalogo.filter((x) => x.grupoMuscular === "Cardio")) {
      expect(pesosDeMusculos(e)).toEqual({});
    }
  });

  it("los 18 músculos del mapa están entrenados por algún ejercicio (ninguno quedó sin usar)", () => {
    const usados = new Set<string>();
    for (const e of catalogo) for (const m of Object.keys(pesosDeMusculos(e))) usados.add(m);

    expect([...usados].sort()).toEqual([...MUSCULOS].sort());
  });

  it("ningún peso es mayor que 1 ni menor o igual a 0", () => {
    for (const e of catalogo) {
      for (const peso of Object.values(pesosDeMusculos(e))) {
        expect(peso).toBeGreaterThan(0);
        expect(peso).toBeLessThanOrEqual(1);
      }
    }
  });
});
