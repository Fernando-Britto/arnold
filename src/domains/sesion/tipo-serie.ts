/**
 * Tipos de serie (T-047, D-64). Constantes y funciones PURAS: no usan Prisma ni React, así se
 * pueden importar tanto desde el servidor como desde la pantalla.
 *
 * - NORMAL: serie de trabajo (valor por defecto; el historial anterior a D-64 es NORMAL).
 * - CALENTAMIENTO: no es una de las series que pide la rutina y NO cuenta para progresión,
 *   marcas personales ni volumen.
 * - HASTA_EL_FALLO: serie de trabajo llevada al límite. Cuenta como cualquier otra.
 * - DROP_SET: serie con la carga reducida a propósito que cuelga de la serie anterior. NO ocupa
 *   una serie de la rutina, no avanza la sesión y la progresión la ignora por completo.
 *
 * Idea tomada de openGym como referencia; no se copió código (AGPL-3.0).
 */

export const TIPOS_DE_SERIE = ["NORMAL", "CALENTAMIENTO", "HASTA_EL_FALLO", "DROP_SET"] as const;

export type TipoSerie = (typeof TIPOS_DE_SERIE)[number];

export const TIPO_SERIE_POR_DEFECTO: TipoSerie = "NORMAL";

export function esTipoSerie(valor: unknown): valor is TipoSerie {
  return typeof valor === "string" && (TIPOS_DE_SERIE as readonly string[]).includes(valor);
}

/**
 * Filtro de Prisma para leer SOLO las series de trabajo: deja afuera el calentamiento. El drop set
 * sí se guarda en el historial (se muestra colgado de su serie), pero la progresión lo ignora en
 * `leerSesion`. Cada consulta de métricas esparce este filtro en su `where` en vez de repetirlo.
 */
export const SOLO_SERIES_DE_TRABAJO = { tipo: { not: "CALENTAMIENTO" } } as const;

/** Nombre de cada tipo en el selector de la pantalla de ejecución. */
export const ETIQUETAS_TIPO_SERIE: Record<TipoSerie, string> = {
  NORMAL: "Normal",
  CALENTAMIENTO: "Calentamiento",
  HASTA_EL_FALLO: "Al fallo",
  DROP_SET: "Drop set",
};

const ETIQUETAS_CORTAS: Record<Exclude<TipoSerie, "NORMAL">, string> = {
  CALENTAMIENTO: "calentamiento",
  HASTA_EL_FALLO: "al fallo",
  DROP_SET: "drop set",
};

/**
 * Etiqueta corta para el historial y el resumen ("drop set", "al fallo"). La serie normal no
 * lleva etiqueta: es lo esperable y no hay nada que aclarar.
 */
export function etiquetaDeTipo(tipo: TipoSerie | undefined | null): string | null {
  if (!tipo || tipo === "NORMAL") return null;
  return ETIQUETAS_CORTAS[tipo];
}

