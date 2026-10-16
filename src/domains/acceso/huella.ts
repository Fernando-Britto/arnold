/**
 * Elección del ID de huella libre (T-041, D-43/D-47). Función pura: sin Prisma ni React.
 *
 * Arnold no guarda plantillas biométricas: sólo la relación socio ↔ `huellaId`. El sensor maneja
 * un espacio de IDs acotado; acá se elige uno libre sin conocer los bytes de la plantilla.
 */

/** Primer ID de plantilla que admite el sensor. */
export const HUELLA_ID_MIN = 1;
/** Último ID de plantilla que admite el sensor (el sensor está lleno al alcanzarlo). */
export const HUELLA_ID_MAX = 1000;
/** Confianza mínima (0..100) que debe reportar el lector para aceptar una huella. */
export const HUELLA_CONFIANZA_MINIMA = 50;

/**
 * Primer ID libre en el rango del sensor. `idsUsados` puede traer duplicados o valores fuera de
 * rango (IDs ya borrados del sensor, reservas): se ignoran. Devuelve `null` si no queda ninguno.
 */
export function elegirHuellaIdLibre(idsUsados: number[]): number | null {
  const usados = new Set(idsUsados);
  for (let id = HUELLA_ID_MIN; id <= HUELLA_ID_MAX; id++) {
    if (!usados.has(id)) return id;
  }
  return null;
}
