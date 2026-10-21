/**
 * Catálogo de ejercicios importado del dataset `hasaneyldrm/exercises-dataset` (D-70).
 * Dominio PURO: sin Prisma ni acceso a datos (lo importan el importador y las pantallas).
 */

/** Mapa de las 10 categorías del dataset a los grupos musculares de Arnold (`GRUPOS_MUSCULARES`). */
const GRUPO_POR_CATEGORIA: Readonly<Record<string, string>> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "lower arms": "Brazos",
  "upper legs": "Piernas",
  "lower legs": "Piernas",
  waist: "Abdomen",
  neck: "Cuello",
  cardio: "Cardio",
};

/** Las categorías que trae el dataset (en inglés, tal como vienen en `category`). */
export const CATEGORIAS_DATASET: readonly string[] = Object.keys(GRUPO_POR_CATEGORIA);

/**
 * Devuelve el grupo muscular de Arnold para una categoría del dataset.
 * Lanza si la categoría no existe: es preferible que el importador falle a que cargue
 * un ejercicio en un grupo inventado.
 */
export function grupoDesdeCategoria(categoria: string): string {
  const grupo = GRUPO_POR_CATEGORIA[categoria.trim().toLowerCase()];
  if (!grupo) throw new Error(`Categoría del dataset desconocida: "${categoria}"`);
  return grupo;
}

/** Registro del dataset (solo los campos que usa Arnold; los demás idiomas se ignoran). */
export interface EjercicioDelDataset {
  id: string;
  name: string;
  category: string;
  equipment: string;
  target: string;
  secondary_muscles: string[];
  instruction_steps: { es: string[] };
  gif_url: string;
}

/** Traducciones de los términos repetidos del dataset (equipamiento y músculos), por clave en inglés. */
export interface Glosario {
  equipamiento: Record<string, string>;
  musculos: Record<string, string>;
}

/** Ejercicio listo para importar: todo en español. */
export interface EjercicioDelCatalogo {
  datasetId: string;
  nombre: string;
  grupoMuscular: string;
  equipamiento: string;
  musculoObjetivo: string;
  musculosSecundarios: string[];
  instrucciones: string[];
  mediaId: string;
}

function traducir(tabla: Record<string, string>, termino: string, que: string): string {
  const es = tabla[termino.trim().toLowerCase()];
  if (!es) throw new Error(`Falta traducir ${que}: "${termino}"`);
  return es;
}

/**
 * Convierte un registro del dataset en un ejercicio de Arnold en español. Falla (en vez de
 * dejar texto en inglés) si falta una traducción, una categoría o las instrucciones: el
 * generador del catálogo y su test de integridad dependen de ese rechazo.
 */
export function construirEjercicioDelCatalogo(
  crudo: EjercicioDelDataset,
  nombres: Readonly<Record<string, string>>,
  glosario: Glosario
): EjercicioDelCatalogo {
  const nombre = nombres[crudo.id]?.trim();
  if (!nombre) throw new Error(`Falta la traducción del nombre del ejercicio ${crudo.id} ("${crudo.name}")`);

  const instrucciones = (crudo.instruction_steps?.es ?? []).map((p) => p.trim()).filter(Boolean);
  if (instrucciones.length === 0) throw new Error(`El ejercicio ${crudo.id} no tiene instrucciones en español`);

  const secundarios = [...new Set(crudo.secondary_muscles.map((m) => traducir(glosario.musculos, m, "el músculo")))];

  return {
    datasetId: crudo.id,
    nombre,
    grupoMuscular: grupoDesdeCategoria(crudo.category),
    equipamiento: traducir(glosario.equipamiento, crudo.equipment, "el equipamiento"),
    musculoObjetivo: traducir(glosario.musculos, crudo.target, "el músculo"),
    musculosSecundarios: secundarios,
    instrucciones,
    mediaId: (crudo.gif_url.split("/").pop() ?? "").replace(/\.[^.]+$/, ""),
  };
}
