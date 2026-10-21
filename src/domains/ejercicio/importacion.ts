/**
 * Planificador de la importación del catálogo de ejercicios (T-050c, D-70).
 * Dominio PURO: recibe el catálogo y lo que ya hay en la base y decide qué crear, qué actualizar y
 * qué dejar en paz. No conoce Prisma; lo ejecuta `prisma/importar-catalogo-data.ts`.
 */
import type { EjercicioDelCatalogo } from "./catalogo";
import { validateEjercicio } from "./ejercicio";

/** Lo que el planificador necesita saber de cada ejercicio que ya está en la base. */
export interface ExistenteEjercicio {
  id: string;
  nombre: string;
  grupoMuscular: string;
  datasetId: string | null;
  equipamiento: string | null;
  musculoObjetivo: string | null;
  musculosSecundarios: string[];
  instrucciones: string[];
  mediaId: string | null;
}

/** Campos que puede cambiar una actualización. */
export type DatosActualizables = Partial<
  Pick<
    EjercicioDelCatalogo,
    "nombre" | "grupoMuscular" | "equipamiento" | "musculoObjetivo" | "musculosSecundarios" | "instrucciones" | "mediaId"
  >
>;

export interface Conflicto {
  datasetId: string;
  nombre: string;
  /** Id del ejercicio de la base con el que choca el nombre. */
  conId: string;
  motivo: string;
}

export interface PlanImportacion {
  crear: EjercicioDelCatalogo[];
  actualizar: { id: string; datasetId: string; datos: DatosActualizables }[];
  sinCambios: number;
  conflictos: Conflicto[];
}

export interface OpcionesImportacion {
  /**
   * Por defecto una reimportación NO pisa nombre ni grupo de un ejercicio ya importado (el admin
   * pudo editarlos). Con esta opción se vuelven a tomar del catálogo (p. ej. tras corregir una traducción).
   */
  sobrescribirNombres?: boolean;
}

/** Clave para comparar nombres: sin tildes, sin mayúsculas y con espacios normalizados. */
const claveDeNombre = (nombre: string): string =>
  nombre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const mismosElementos = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function planificarImportacion(
  catalogo: readonly EjercicioDelCatalogo[],
  existentes: readonly ExistenteEjercicio[],
  opciones: OpcionesImportacion = {}
): PlanImportacion {
  // Falla antes de planear nada: un catálogo con un ejercicio inválido no se importa a medias.
  for (const e of catalogo) {
    const v = validateEjercicio({ nombre: e.nombre, grupoMuscular: e.grupoMuscular });
    if (!v.valid) throw new Error(`El ejercicio ${e.datasetId} ("${e.nombre}") es inválido: ${v.errors.join("; ")}`);
  }

  const porDatasetId = new Map(existentes.filter((x) => x.datasetId).map((x) => [x.datasetId as string, x]));
  // clave de nombre → id de quien lo usa (de la base o recién planeado)
  const nombres = new Map(existentes.map((x) => [claveDeNombre(x.nombre), x.id]));

  const plan: PlanImportacion = { crear: [], actualizar: [], sinCambios: 0, conflictos: [] };

  for (const item of catalogo) {
    const actual = porDatasetId.get(item.datasetId);

    if (!actual) {
      const dueño = nombres.get(claveDeNombre(item.nombre));
      if (dueño) {
        plan.conflictos.push({
          datasetId: item.datasetId, nombre: item.nombre, conId: dueño,
          motivo: "Ya existe un ejercicio con ese nombre; no se importa para no duplicarlo",
        });
        continue;
      }
      nombres.set(claveDeNombre(item.nombre), `nuevo:${item.datasetId}`);
      plan.crear.push(item);
      continue;
    }

    const datos: DatosActualizables = {};
    if (actual.equipamiento !== item.equipamiento) datos.equipamiento = item.equipamiento;
    if (actual.musculoObjetivo !== item.musculoObjetivo) datos.musculoObjetivo = item.musculoObjetivo;
    if (!mismosElementos(actual.musculosSecundarios, item.musculosSecundarios)) datos.musculosSecundarios = item.musculosSecundarios;
    if (!mismosElementos(actual.instrucciones, item.instrucciones)) datos.instrucciones = item.instrucciones;
    if (actual.mediaId !== item.mediaId) datos.mediaId = item.mediaId;

    if (opciones.sobrescribirNombres) {
      if (actual.nombre !== item.nombre) {
        const dueño = nombres.get(claveDeNombre(item.nombre));
        if (dueño && dueño !== actual.id) {
          plan.conflictos.push({
            datasetId: item.datasetId, nombre: item.nombre, conId: dueño,
            motivo: "El nombre del catálogo ya lo usa otro ejercicio; no se renombra",
          });
          continue;
        }
        nombres.delete(claveDeNombre(actual.nombre));
        nombres.set(claveDeNombre(item.nombre), actual.id);
        datos.nombre = item.nombre;
      }
      if (actual.grupoMuscular !== item.grupoMuscular) datos.grupoMuscular = item.grupoMuscular;
    }

    if (Object.keys(datos).length === 0) plan.sinCambios++;
    else plan.actualizar.push({ id: actual.id, datasetId: item.datasetId, datos });
  }

  return plan;
}
