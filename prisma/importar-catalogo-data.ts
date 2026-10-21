import type { EjercicioDelCatalogo } from "../src/domains/ejercicio/catalogo";
import {
  planificarImportacion,
  type Conflicto,
  type DatosActualizables,
  type ExistenteEjercicio,
  type OpcionesImportacion,
} from "../src/domains/ejercicio/importacion";

/** Lo mínimo que se usa de Prisma (el CLI le pasa el PrismaClient real; los tests, una base en memoria). */
export interface ClienteImportador {
  ejercicio: {
    findMany(args: { select: Record<string, true> }): Promise<ExistenteEjercicio[]>;
    createMany(args: { data: EjercicioDelCatalogo[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
    update(args: { where: { id: string }; data: DatosActualizables }): Promise<unknown>;
  };
  $transaction(operaciones: Promise<unknown>[]): Promise<unknown[]>;
}

export interface OpcionesEjecucion extends OpcionesImportacion {
  /** Calcula e informa el plan sin escribir nada. */
  dryRun?: boolean;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
  sinCambios: number;
  conflictos: Conflicto[];
  dryRun: boolean;
}

const LOTE_CREAR = 200;
const LOTE_ACTUALIZAR = 100;

const lotes = <T>(items: readonly T[], tamaño: number): T[][] => {
  const salida: T[][] = [];
  for (let i = 0; i < items.length; i += tamaño) salida.push(items.slice(i, i + tamaño));
  return salida;
};

/**
 * Importa el catálogo de ejercicios (D-70). Repetible: lo ya importado y sin cambios no se vuelve
 * a escribir, y los ejercicios cargados a mano no se tocan. Escribe en lotes para no hacer 1.324
 * viajes a la base.
 */
export async function importarCatalogo(
  prisma: ClienteImportador,
  catalogo: readonly EjercicioDelCatalogo[],
  opciones: OpcionesEjecucion = {}
): Promise<ResultadoImportacion> {
  const existentes = await prisma.ejercicio.findMany({
    select: {
      id: true, nombre: true, grupoMuscular: true, datasetId: true, equipamiento: true,
      musculoObjetivo: true, musculosSecundarios: true, instrucciones: true, mediaId: true,
    },
  });

  const plan = planificarImportacion(catalogo, existentes, { sobrescribirNombres: opciones.sobrescribirNombres });
  const resultado: ResultadoImportacion = {
    creados: plan.crear.length,
    actualizados: plan.actualizar.length,
    sinCambios: plan.sinCambios,
    conflictos: plan.conflictos,
    dryRun: opciones.dryRun === true,
  };
  if (opciones.dryRun) return resultado;

  for (const lote of lotes(plan.crear, LOTE_CREAR)) {
    await prisma.ejercicio.createMany({ data: lote, skipDuplicates: true });
  }
  for (const lote of lotes(plan.actualizar, LOTE_ACTUALIZAR)) {
    await prisma.$transaction(lote.map((u) => prisma.ejercicio.update({ where: { id: u.id }, data: u.datos })));
  }
  return resultado;
}
