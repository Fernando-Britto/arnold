/**
 * Cache de listas en memoria del navegador (por pestaña), con TTL corto (T-052/rendimiento).
 *
 * No es un cache compartido entre usuarios: vive solo en el cliente, no usa `localStorage` ni el
 * servidor, y el logout lo limpia. Su objetivo es que volver a una pantalla ya visitada no vuelva
 * a pedir la lista completa; las mutaciones invalidan la clave que cambian.
 */

/** Claves de las listas cacheadas. Centralizadas para no repetir strings. */
export const CLAVES = {
  clientes: "clientes",
  ejercicios: "ejercicios",
  membresias: "membresias",
  membresiasActivas: "membresias-activas",
  rutinas: "rutinas",
} as const;

const TTL_POR_DEFECTO = 60_000;

interface Entrada {
  valor: unknown;
  vence: number;
}

const cache = new Map<string, Entrada>();
const enVuelo = new Map<string, Promise<unknown>>();

/**
 * Devuelve el valor cacheado de `clave` o lo carga. Dos llamadas concurrentes a la misma clave
 * comparten una sola petición. Un error no se cachea: el próximo intento vuelve a pedir.
 */
export async function conCache<T>(
  clave: string,
  cargar: () => Promise<T>,
  ttlMs = TTL_POR_DEFECTO
): Promise<T> {
  const guardado = cache.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor as T;

  const pendiente = enVuelo.get(clave);
  if (pendiente) return pendiente as Promise<T>;

  const promesa = cargar()
    .then((valor) => {
      cache.set(clave, { valor, vence: Date.now() + ttlMs });
      return valor;
    })
    .finally(() => {
      enVuelo.delete(clave);
    });

  enVuelo.set(clave, promesa);
  return promesa;
}

/** Descarta una o más listas: la próxima visita las vuelve a pedir. */
export function invalidarCache(...claves: string[]): void {
  for (const clave of claves) {
    cache.delete(clave);
    enVuelo.delete(clave);
  }
}

/** Vacía todo (logout o cambio de usuario). */
export function limpiarCache(): void {
  cache.clear();
  enVuelo.clear();
}
