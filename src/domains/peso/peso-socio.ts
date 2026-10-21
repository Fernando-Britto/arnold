/**
 * Peso corporal del socio (T-048, D-65): registrar un pesaje, borrar uno propio y fijar o borrar la meta.
 * Las reglas de cálculo (rangos, progreso hacia la meta, puntos del gráfico) viven en
 * `peso-corporal.ts`, que es puro; acá solo se lee y se escribe en la base.
 */
import { validarPeso } from "./peso-corporal";

export interface PesajeRegistrado {
  id: string;
  /** kg. */
  peso: number;
  fecha: Date;
}

/**
 * Guarda un pesaje del socio.
 * @throws Error("VALIDATION_ERROR: ...") si el peso no es un número o está fuera de rango.
 */
export async function registrarPeso(input: {
  socioId: string;
  peso: number;
  /** Inyectable en tests; sin él la base pone la hora actual. */
  ahora?: Date;
}): Promise<PesajeRegistrado> {
  const peso = validarPeso(input.peso);
  const { prisma } = await import("@/lib/db");

  const fila = await prisma.medicionDePeso.create({
    data: { socioId: input.socioId, peso, fecha: input.ahora },
  });
  return { id: fila.id, peso: Number(fila.peso), fecha: fila.fecha };
}

export interface MetaDePeso {
  pesoObjetivo: number | null;
  /** Peso desde el que se fijó la meta; `null` si no hay meta. */
  pesoInicial: number | null;
}

/**
 * Fija la meta de peso del socio, o la borra si `pesoObjetivo` es `null`.
 *
 * La meta guarda el último pesaje como peso de partida: sin él no se sabe si el objetivo era
 * bajar o subir (ver `progresoHaciaMeta`). Por eso no se puede fijar una meta sin haberse pesado.
 *
 * @throws Error("VALIDATION_ERROR: ...") si la meta es inválida o el socio nunca registró su peso.
 */
export async function fijarMetaDePeso(input: {
  socioId: string;
  pesoObjetivo: number | null;
}): Promise<MetaDePeso> {
  const { prisma } = await import("@/lib/db");

  if (input.pesoObjetivo === null) {
    await prisma.socio.update({
      where: { id: input.socioId },
      data: { pesoObjetivo: null, pesoInicialDeMeta: null },
    });
    return { pesoObjetivo: null, pesoInicial: null };
  }

  const pesoObjetivo = validarPeso(input.pesoObjetivo, "La meta");
  const ultimo = await prisma.medicionDePeso.findFirst({
    where: { socioId: input.socioId },
    orderBy: { fecha: "desc" },
    select: { peso: true },
  });
  if (!ultimo) {
    throw new Error("VALIDATION_ERROR: Registrá tu peso antes de fijar una meta");
  }

  const pesoInicial = Number(ultimo.peso);
  await prisma.socio.update({
    where: { id: input.socioId },
    data: { pesoObjetivo, pesoInicialDeMeta: pesoInicial },
  });
  return { pesoObjetivo, pesoInicial };
}

/**
 * Borra un pesaje del socio. Solo el dueño: el `socioId` sale del token y filtra el delete, así
 * un id ajeno no se puede borrar ni se puede distinguir de uno inexistente.
 *
 * @throws Error("NOT_FOUND") si el pesaje no existe o no es del socio.
 */
export async function borrarPeso(input: { socioId: string; id: string }): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const borrados = await prisma.medicionDePeso.deleteMany({
    where: { id: input.id, socioId: input.socioId },
  });
  if (borrados.count === 0) throw new Error("NOT_FOUND");
}
