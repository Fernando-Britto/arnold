import fs from "fs";
import path from "path";
import type { EjercicioDelCatalogo } from "@/domains/ejercicio/catalogo";
import { importarCatalogo, type ClienteImportador } from "../../prisma/importar-catalogo-data";
import { EJERCICIOS as EJERCICIOS_DEL_SEED } from "../../prisma/seed-data";
import { planificarImportacion } from "@/domains/ejercicio/importacion";

type Fila = {
  id: string; nombre: string; grupoMuscular: string; datasetId: string | null; equipamiento: string | null;
  musculoObjetivo: string | null; musculosSecundarios: string[]; instrucciones: string[]; mediaId: string | null;
};

/** Base en memoria: lleva la cuenta de cuántas escrituras (createMany/update) se hicieron. */
function fakeDb(inicial: Fila[] = []) {
  const filas = [...inicial];
  const log = { createMany: [] as number[], update: 0, transaction: [] as number[] };
  let n = 0;
  const cliente: ClienteImportador = {
    ejercicio: {
      findMany: async () => filas.map((f) => ({ ...f })),
      createMany: async ({ data }) => {
        log.createMany.push(data.length);
        for (const d of data) filas.push({ id: `nuevo-${++n}`, ...d } as Fila);
        return { count: data.length };
      },
      update: ({ where, data }) => {
        log.update++;
        const f = filas.find((x) => x.id === where.id)!;
        Object.assign(f, data);
        return Promise.resolve(f);
      },
    },
    $transaction: async (ops) => {
      log.transaction.push(ops.length);
      return Promise.all(ops);
    },
  };
  return { cliente, filas, log };
}

const ej = (n: number, extra: Partial<EjercicioDelCatalogo> = {}): EjercicioDelCatalogo => ({
  datasetId: String(n).padStart(4, "0"), nombre: `Ejercicio ${n}`, grupoMuscular: "Pecho", equipamiento: "Barra",
  musculoObjetivo: "Pectorales", musculosSecundarios: [], instrucciones: ["Paso"], mediaId: `${String(n).padStart(4, "0")}-x`,
  ...extra,
});

describe("importarCatalogo (T-050c, D-70)", () => {
  it("crea los ejercicios en lotes de hasta 200", async () => {
    const { cliente, filas, log } = fakeDb();
    const catalogo = Array.from({ length: 450 }, (_, i) => ej(i + 1));
    const r = await importarCatalogo(cliente, catalogo);
    expect(filas).toHaveLength(450);
    expect(log.createMany).toEqual([200, 200, 50]);
    expect(r).toMatchObject({ creados: 450, actualizados: 0, conflictos: [] });
  });

  it("correrlo dos veces no duplica ni vuelve a escribir nada", async () => {
    const { cliente, filas, log } = fakeDb();
    const catalogo = [ej(1), ej(2), ej(3)];
    await importarCatalogo(cliente, catalogo);
    const antes = { createMany: log.createMany.length, update: log.update };
    const r = await importarCatalogo(cliente, catalogo);
    expect(filas).toHaveLength(3);
    expect(log.createMany.length).toBe(antes.createMany);
    expect(log.update).toBe(antes.update);
    expect(r).toMatchObject({ creados: 0, actualizados: 0, sinCambios: 3 });
  });

  it("actualiza los datos cambiados en transacciones de hasta 100, sin pisar el nombre editado", async () => {
    const catalogo = Array.from({ length: 150 }, (_, i) => ej(i + 1));
    const { cliente, filas, log } = fakeDb();
    await importarCatalogo(cliente, catalogo);
    filas[0].nombre = "Nombre editado por el admin";

    const cambiado = catalogo.map((e) => ({ ...e, instrucciones: ["Paso corregido"] }));
    const r = await importarCatalogo(cliente, cambiado);

    expect(r.actualizados).toBe(150);
    expect(log.transaction).toEqual([100, 50]);
    expect(filas[0].nombre).toBe("Nombre editado por el admin");
    expect(filas[0].instrucciones).toEqual(["Paso corregido"]);
  });

  it("--dry-run informa lo que haría sin escribir nada", async () => {
    const { cliente, filas, log } = fakeDb();
    const r = await importarCatalogo(cliente, [ej(1), ej(2)], { dryRun: true });
    expect(r).toMatchObject({ creados: 2, dryRun: true });
    expect(filas).toHaveLength(0);
    expect(log.createMany).toEqual([]);
  });

  it("no toca los ejercicios cargados a mano y reporta los que chocan por nombre", async () => {
    const manual: Fila = {
      id: "m1", nombre: "Ejercicio 1", grupoMuscular: "Pecho", datasetId: null, equipamiento: null,
      musculoObjetivo: null, musculosSecundarios: [], instrucciones: [], mediaId: null,
    };
    const { cliente, filas } = fakeDb([manual]);
    const r = await importarCatalogo(cliente, [ej(1), ej(2)]);
    expect(r.creados).toBe(1);
    expect(r.conflictos).toEqual([expect.objectContaining({ datasetId: "0001", conId: "m1" })]);
    expect(filas.find((f) => f.id === "m1")).toEqual(manual);
  });
});

describe("el catálogo real frente a los ejercicios del seed", () => {
  it("el seed y el catálogo no chocan por nombre (importar no genera conflictos en una base de desarrollo)", () => {
    const catalogo = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "prisma", "data", "ejercicios-es.json"), "utf-8")
    ) as EjercicioDelCatalogo[];
    const delSeed = EJERCICIOS_DEL_SEED.map((e, i) => ({
      id: `seed-${i}`, nombre: e.nombre, grupoMuscular: e.grupoMuscular, datasetId: null,
      equipamiento: null, musculoObjetivo: null, musculosSecundarios: [], instrucciones: [], mediaId: null,
    }));
    const plan = planificarImportacion(catalogo, delSeed);
    expect(plan.conflictos).toEqual([]);
    expect(plan.crear).toHaveLength(1324);
  });
});
