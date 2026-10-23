/**
 * Búsqueda y filtros del catálogo de ejercicios (T-052, D-72). Dominio PURO: sin Prisma ni React.
 *
 * Con el catálogo de 1.330 ejercicios (D-70) buscar solo por el texto exacto del nombre no alcanza:
 * - no distingue mayúsculas ni tildes ("biceps" encuentra "Bíceps");
 * - todas las palabras tienen que aparecer, aunque no estén seguidas ni en el mismo orden
 *   ("press banca" encuentra "Press de banca con barra");
 * - se busca en el nombre, el grupo muscular, el equipamiento y el músculo objetivo.
 */

/** Minúsculas, sin tildes y con los espacios colapsados. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lo mínimo de un ejercicio que hace falta para buscarlo. */
export interface BuscableEjercicio {
  nombre: string;
  grupoMuscular: string;
  equipamiento?: string | null;
  musculoObjetivo?: string | null;
}

export interface FiltroDeEjercicios {
  texto?: string;
  /** Grupo muscular exacto; vacío o ausente = todos. */
  grupo?: string;
  /** Equipamiento exacto; vacío o ausente = todos. */
  equipamiento?: string;
}

// El texto normalizado de cada ejercicio se calcula una sola vez: se vuelve a buscar con cada tecla
// sobre más de mil ejercicios y normalizar es lo más caro de la búsqueda.
const PAJAR = new WeakMap<object, string>();

function pajarDe(ejercicio: BuscableEjercicio): string {
  let pajar = PAJAR.get(ejercicio);
  if (pajar === undefined) {
    pajar = normalizarTexto(
      [ejercicio.nombre, ejercicio.grupoMuscular, ejercicio.equipamiento, ejercicio.musculoObjetivo]
        .filter(Boolean)
        .join(" ")
    );
    PAJAR.set(ejercicio, pajar);
  }
  return pajar;
}

/** Los ejercicios que cumplen el texto, el grupo y el equipamiento, en el mismo orden. No modifica la lista. */
export function filtrarEjercicios<T extends BuscableEjercicio>(
  ejercicios: T[],
  filtro: FiltroDeEjercicios
): T[] {
  const palabras = normalizarTexto(filtro.texto ?? "")
    .split(" ")
    .filter(Boolean);

  return ejercicios.filter((e) => {
    if (filtro.grupo && e.grupoMuscular !== filtro.grupo) return false;
    if (filtro.equipamiento && e.equipamiento !== filtro.equipamiento) return false;
    if (palabras.length === 0) return true;
    const pajar = pajarDe(e);
    return palabras.every((palabra) => pajar.includes(palabra));
  });
}

/** Valores distintos, sin vacíos y ordenados sin tener en cuenta las tildes (para las opciones de un filtro). */
export function opcionesDeFiltro(valores: Array<string | null | undefined>): string[] {
  const distintos = [...new Set(valores.filter((v): v is string => Boolean(v)))];
  return distintos.sort((a, b) => {
    const [na, nb] = [normalizarTexto(a), normalizarTexto(b)];
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}
