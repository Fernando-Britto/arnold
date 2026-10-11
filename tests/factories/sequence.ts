/**
 * Secuencias deterministas para las factories (T-024).
 * Nada es aleatorio: con `resetFactories()` en un `beforeEach`, cada test arranca
 * con los mismos ids, DNI y emails, así los fallos se reproducen.
 */
const counters = new Map<string, number>();

/** Próximo número (1, 2, 3…) de la secuencia `name`. */
export function nextSeq(name: string): number {
  const n = (counters.get(name) ?? 0) + 1;
  counters.set(name, n);
  return n;
}

export function resetFactories(): void {
  counters.clear();
}

/** Fecha fija para createdAt/updatedAt/fechaAlta. Devuelve una instancia nueva cada vez. */
export function fixedDate(): Date {
  return new Date("2026-01-01T00:00:00.000Z");
}
