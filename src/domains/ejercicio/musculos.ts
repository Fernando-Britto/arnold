/**
 * Músculos de un ejercicio (T-051, D-71). Dominio PURO: sin Prisma ni React, así lo importan el
 * servidor y las pantallas.
 *
 * El catálogo (D-70) nombra los músculos con texto libre y no es parejo: "Hombros", "Deltoides" y
 * "Deltoides posteriores" son lo mismo; también "Trapecio" y "Trapecios", o "Dorsales" y "Dorsal ancho".
 * Acá los 47 términos distintos del catálogo se reducen a los 18 músculos que un mapa corporal puede
 * dibujar. Lo que no se puede dibujar (manos, pies, el sistema cardiovascular) da `null` y se descarta;
 * un término que no se conoce LANZA, para que falle el importador y no salga mal el volumen.
 *
 * Cada ejercicio reparte su peso entre los músculos: el objetivo cuenta 1 y cada secundario 0,4. Los
 * ejercicios sin músculos (los del seed y los cargados a mano) usan su grupo muscular.
 *
 * Idea tomada de openGym como referencia (sus 18 músculos y el peso menor para los secundarios); la
 * tabla de términos, los nombres y los pesos de respaldo son propios. No se copió código (AGPL-3.0).
 */

/** Los músculos que se pueden dibujar, de la cabeza a los pies. */
export const MUSCULOS = [
  "trapecios",
  "deltoides",
  "pecho",
  "espalda-alta",
  "serrato",
  "biceps",
  "triceps",
  "antebrazos",
  "abdominales",
  "oblicuos",
  "zona-lumbar",
  "gluteos",
  "cuadriceps",
  "isquiotibiales",
  "aductores",
  "flexores-de-cadera",
  "gemelos",
  "tibial",
] as const;

export type Musculo = (typeof MUSCULOS)[number];

/** Nombre en español para mostrar. */
export const ETIQUETAS_MUSCULO: Readonly<Record<Musculo, string>> = {
  trapecios: "Trapecios",
  deltoides: "Hombros",
  pecho: "Pecho",
  "espalda-alta": "Espalda",
  serrato: "Serrato",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazos: "Antebrazos",
  abdominales: "Abdominales",
  oblicuos: "Oblicuos",
  "zona-lumbar": "Zona lumbar",
  gluteos: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  aductores: "Aductores",
  "flexores-de-cadera": "Flexores de cadera",
  gemelos: "Gemelos",
  tibial: "Tibial",
};

/** Cuánto cuenta un músculo secundario frente al objetivo (que cuenta 1). */
export const PESO_SECUNDARIO = 0.4;

/** Cada término del catálogo y el músculo al que corresponde (`null` = no se dibuja). */
const TERMINOS: Readonly<Record<string, Musculo | null>> = {
  Abdominales: "abdominales",
  "Abdominales inferiores": "abdominales",
  "Zona media (core)": "abdominales",
  Oblicuos: "oblicuos",
  Pectorales: "pecho",
  Pecho: "pecho",
  "Pecho superior": "pecho",
  Bíceps: "biceps",
  Braquial: "biceps",
  Tríceps: "triceps",
  Antebrazos: "antebrazos",
  Muñecas: "antebrazos",
  "Flexores de la muñeca": "antebrazos",
  "Extensores de la muñeca": "antebrazos",
  "Músculos de agarre": "antebrazos",
  Glúteos: "gluteos",
  Abductores: "gluteos",
  Deltoides: "deltoides",
  "Deltoides posteriores": "deltoides",
  Hombros: "deltoides",
  "Manguito rotador": "deltoides",
  "Espalda alta": "espalda-alta",
  Dorsales: "espalda-alta",
  "Dorsal ancho": "espalda-alta",
  Espalda: "espalda-alta",
  Romboides: "espalda-alta",
  Trapecio: "trapecios",
  Trapecios: "trapecios",
  "Elevador de la escápula": "trapecios",
  "Serrato anterior": "serrato",
  Columna: "zona-lumbar",
  "Zona lumbar": "zona-lumbar",
  Cuádriceps: "cuadriceps",
  Isquiotibiales: "isquiotibiales",
  Aductores: "aductores",
  Ingle: "aductores",
  "Muslos internos": "aductores",
  "Flexores de cadera": "flexores-de-cadera",
  Gemelos: "gemelos",
  Sóleo: "gemelos",
  Tibiales: "tibial",
  // No se dibujan en un mapa corporal.
  Manos: null,
  Pies: null,
  Tobillos: null,
  "Estabilizadores del tobillo": null,
  Esternocleidomastoideo: null,
  "Sistema cardiovascular": null,
};

/** Minúsculas, sin tildes ni espacios de más: "Bíceps", "biceps" y " BICEPS " son el mismo término. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const POR_TERMINO_NORMALIZADO: ReadonlyMap<string, Musculo | null> = new Map(
  Object.entries(TERMINOS).map(([termino, musculo]) => [normalizar(termino), musculo])
);

/**
 * El músculo del mapa para un término del catálogo, o `null` si no se dibuja (manos, pies, el sistema
 * cardiovascular). LANZA con un término que no conoce.
 */
export function musculoDesdeTermino(termino: string): Musculo | null {
  const musculo = POR_TERMINO_NORMALIZADO.get(normalizar(termino));
  if (musculo === undefined) throw new Error(`Músculo desconocido en el catálogo: "${termino}"`);
  return musculo;
}

/** Peso de cada músculo; los que no se entrenan no aparecen. */
export type PesosMusculares = Partial<Record<Musculo, number>>;

/** Lo mínimo de un ejercicio que hace falta para saber qué músculos entrena. */
export interface DatosMusculares {
  grupoMuscular: string;
  musculoObjetivo?: string | null;
  musculosSecundarios?: string[] | null;
}

/**
 * Cómo se reparte el peso cuando el ejercicio no trae músculos: según su grupo. Cada grupo suma 1
 * (un grupo que entrena varios músculos no cuenta doble). Cardio no entrena ninguno.
 */
const POR_GRUPO: Readonly<Record<string, PesosMusculares>> = {
  Pecho: { pecho: 1 },
  Espalda: { "espalda-alta": 0.75, "zona-lumbar": 0.25 },
  Hombros: { deltoides: 1 },
  Brazos: { biceps: 0.5, triceps: 0.5 },
  Piernas: { cuadriceps: 0.4, isquiotibiales: 0.3, gluteos: 0.3 },
  Abdomen: { abdominales: 0.7, oblicuos: 0.3 },
  Cuello: { trapecios: 1 },
  Cardio: {},
};

/** Como `musculoDesdeTermino` pero sin lanzar: un término raro en la base no debe romper una pantalla. */
function buscarMusculo(termino: string): Musculo | null {
  return POR_TERMINO_NORMALIZADO.get(normalizar(termino)) ?? null;
}

/**
 * Qué músculos entrena un ejercicio y con qué peso: el objetivo cuenta 1 y cada secundario distinto
 * 0,4. Dos términos que son el mismo músculo cuentan una vez y, si un secundario coincide con el
 * objetivo, manda el objetivo. Sin músculo objetivo se usa el grupo muscular.
 *
 * El **cardio no suma músculos** aunque el catálogo le anote secundarios (la bicicleta trae cuádriceps
 * y gemelos): una serie de cardio no es una serie de fuerza y sumaría volumen que no existió.
 *
 * Un término desconocido se descarta en vez de lanzar: la integridad del catálogo la cuida su test, y
 * acá una fila rara no debería dejar sin pantalla al socio.
 */
export function pesosDeMusculos(ejercicio: DatosMusculares): PesosMusculares {
  if (ejercicio.grupoMuscular === "Cardio") return {};

  const objetivo = ejercicio.musculoObjetivo?.trim();
  if (!objetivo) return { ...(POR_GRUPO[ejercicio.grupoMuscular] ?? {}) };

  const pesos: PesosMusculares = {};
  const principal = buscarMusculo(objetivo);
  if (principal) pesos[principal] = 1;

  for (const termino of ejercicio.musculosSecundarios ?? []) {
    const musculo = buscarMusculo(termino);
    if (musculo && pesos[musculo] === undefined) pesos[musculo] = PESO_SECUNDARIO;
  }
  return pesos;
}

/**
 * Volumen por músculo: la suma, para cada ejercicio, de sus series por el peso de cada músculo. Las
 * "series" son las de trabajo; quien llama deja afuera calentamientos y drop sets. Un músculo que no
 * se entrenó no aparece.
 */
export function volumenPorMusculo(
  entradas: Array<{ ejercicio: DatosMusculares; series: number }>
): PesosMusculares {
  const volumen: PesosMusculares = {};
  for (const { ejercicio, series } of entradas) {
    if (!Number.isFinite(series) || series <= 0) continue;
    for (const [musculo, peso] of Object.entries(pesosDeMusculos(ejercicio)) as Array<[Musculo, number]>) {
      volumen[musculo] = (volumen[musculo] ?? 0) + series * peso;
    }
  }
  return volumen;
}
