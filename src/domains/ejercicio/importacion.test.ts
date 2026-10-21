import type { EjercicioDelCatalogo } from "./catalogo";
import { planificarImportacion, type ExistenteEjercicio } from "./importacion";

const cat = (n: number, extra: Partial<EjercicioDelCatalogo> = {}): EjercicioDelCatalogo => ({
  datasetId: String(n).padStart(4, "0"),
  nombre: `Ejercicio ${n}`,
  grupoMuscular: "Pecho",
  equipamiento: "Barra",
  musculoObjetivo: "Pectorales",
  musculosSecundarios: ["Tríceps"],
  instrucciones: ["Paso 1", "Paso 2"],
  mediaId: `${String(n).padStart(4, "0")}-abc`,
  ...extra,
});

/** Lo que ya hay en la base para un ejercicio del catálogo importado antes. */
const enBase = (e: EjercicioDelCatalogo, id = `id-${e.datasetId}`, extra: Partial<ExistenteEjercicio> = {}): ExistenteEjercicio => ({
  id,
  nombre: e.nombre,
  grupoMuscular: e.grupoMuscular,
  datasetId: e.datasetId,
  equipamiento: e.equipamiento,
  musculoObjetivo: e.musculoObjetivo,
  musculosSecundarios: [...e.musculosSecundarios],
  instrucciones: [...e.instrucciones],
  mediaId: e.mediaId,
  ...extra,
});

const manual = (nombre: string, id = "manual-1"): ExistenteEjercicio => ({
  id, nombre, grupoMuscular: "Pecho", datasetId: null,
  equipamiento: null, musculoObjetivo: null, musculosSecundarios: [], instrucciones: [], mediaId: null,
});

describe("planificarImportacion: qué hay que crear, actualizar o dejar en paz (D-70)", () => {
  it("con la base vacía crea todo el catálogo", () => {
    const plan = planificarImportacion([cat(1), cat(2)], []);
    expect(plan.crear.map((e) => e.datasetId)).toEqual(["0001", "0002"]);
    expect(plan.actualizar).toEqual([]);
    expect(plan.conflictos).toEqual([]);
  });

  it("es idempotente: si todo ya está importado igual, no hay nada que escribir", () => {
    const catalogo = [cat(1), cat(2)];
    const plan = planificarImportacion(catalogo, catalogo.map((e) => enBase(e)));
    expect(plan.crear).toEqual([]);
    expect(plan.actualizar).toEqual([]);
    expect(plan.sinCambios).toBe(2);
  });

  it("actualiza los datos del catálogo de un ejercicio ya importado, sin tocar nombre ni grupo", () => {
    const nuevo = cat(1, { instrucciones: ["Paso nuevo"], mediaId: "0001-nuevo" });
    const viejo = enBase(cat(1), "id-1", { nombre: "Nombre que editó el admin", grupoMuscular: "Brazos" });
    const plan = planificarImportacion([nuevo], [viejo]);
    expect(plan.actualizar).toEqual([
      { id: "id-1", datasetId: "0001", datos: { instrucciones: ["Paso nuevo"], mediaId: "0001-nuevo" } },
    ]);
  });

  it("con sobrescribirNombres también actualiza nombre y grupo desde el catálogo", () => {
    const viejo = enBase(cat(1), "id-1", { nombre: "Nombre viejo", grupoMuscular: "Brazos" });
    const plan = planificarImportacion([cat(1)], [viejo], { sobrescribirNombres: true });
    expect(plan.actualizar[0].datos).toEqual({ nombre: "Ejercicio 1", grupoMuscular: "Pecho" });
  });

  it("no crea un ejercicio si ya hay uno cargado a mano con ese nombre: lo informa como conflicto", () => {
    const plan = planificarImportacion([cat(1, { nombre: "Press banca con barra" })], [manual("  press BANCA con barra ")]);
    expect(plan.crear).toEqual([]);
    expect(plan.conflictos).toEqual([
      expect.objectContaining({ datasetId: "0001", nombre: "Press banca con barra", conId: "manual-1" }),
    ]);
  });

  it("el conflicto de nombre ignora tildes y mayúsculas", () => {
    const plan = planificarImportacion([cat(1, { nombre: "Curl de bíceps con barra" })], [manual("curl de biceps con barra")]);
    expect(plan.conflictos).toHaveLength(1);
  });

  it("deja en paz los ejercicios manuales que no chocan con el catálogo", () => {
    const plan = planificarImportacion([cat(1)], [manual("Mi ejercicio propio")]);
    expect(plan.crear).toHaveLength(1);
    expect(plan.actualizar).toEqual([]);
    expect(plan.conflictos).toEqual([]);
  });

  it("con sobrescribirNombres, un renombre que choca con otro ejercicio es conflicto y no se aplica", () => {
    const viejo = enBase(cat(1), "id-1", { nombre: "Nombre viejo" });
    const plan = planificarImportacion([cat(1)], [viejo, manual("Ejercicio 1", "otro")], { sobrescribirNombres: true });
    expect(plan.actualizar).toEqual([]);
    expect(plan.conflictos).toEqual([expect.objectContaining({ datasetId: "0001", conId: "otro" })]);
  });

  it("falla antes de planear nada si algún ejercicio del catálogo es inválido", () => {
    expect(() => planificarImportacion([cat(1), cat(2, { grupoMuscular: "Tentáculos" })], [])).toThrow(/0002/);
  });
});
