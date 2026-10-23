import type { Ejercicio, EjercicioEnRutina, Prisma, Rutina } from "@prisma/client";
import { RutinaRepository } from "@/domains/rutina/rutina-repositorio";
import { throwIfNotOk } from "@/utils/api-error";
import { CLAVES, conCache, invalidarCache } from "@/lib/cache-cliente";

/**
 * Fila de ejercicio dentro de una rutina, tal como la consume el formulario de edición.
 * Vive en la capa API (no en `src/components`) para respetar la dirección de dependencias:
 * el componente la importa desde acá, no al revés.
 */
export interface EjercicioEnRutinaRow {
  ejercicioId: string;
  ejercicioNombre: string;
  series: number;
  repeticiones: number;
  descanso: number; // almacenado en segundos
  orden?: number; // posición 0-indexada para el reordenamiento
}

export type RutinaWithCount = Rutina & { _count: { ejercicios: number } };

/**
 * Rutina detail as consumed by the edit form: the exercises are already shaped
 * as `EjercicioEnRutinaRow` (name included, `descanso` in seconds) so the form
 * can render and re-submit them without losing the subsection.
 */
export type RutinaDetalle = Rutina & { ejercicios: EjercicioEnRutinaRow[] };

/** Raw row returned by GET /api/rutinas/:id (includes the nested ejercicio). */
type EjercicioEnRutinaApiRow = EjercicioEnRutina & { ejercicio?: Ejercicio };

/**
 * Rutina input type for create operations
 */
export interface RutinaInput {
  nombre: string;
  objetivoPrincipal: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: string;
  /**
   * NF-14: `undefined` = no cambiar; `null` = vaciar la descripción (columna nullable).
   */
  descripcion?: string | null;
}

export interface EjercicioEnRutinaInput {
  ejercicioId: string;
  series: number;
  repeticiones: number;
  descanso: number;
  orden?: number;
}

/**
 * NF-3: `0` es un descanso legítimo, así que no se puede usar `Number(x) || 60`
 * (convertiría 0 en 60). Solo se aplica el default cuando no es un número finito.
 */
function normalizarDescanso(value: unknown): number {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 60;
}

/**
 * NF-11: la unique `[rutinaId, ejercicioId]` impide el mismo ejercicio dos veces en
 * una rutina. `createMany` no deduplica: si Prisma devuelve `P2002`, se traduce a un
 * conflicto de dominio (`DUPLICATE_EXERCISE`, 409) en lugar de dejar que explote como 500.
 */
function throwDuplicateExercise(): never {
  throw Object.assign(
    new Error("DUPLICATE_EXERCISE: El ejercicio ya está en la rutina"),
    { code: "DUPLICATE_EXERCISE" }
  );
}

function esErrorP2002(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/** Fila de ejercicio ya normalizada: lo que se compara y se escribe. */
interface FilaEjercicio {
  ejercicioId: string;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
}

function normalizarEjercicio(ej: EjercicioEnRutinaInput, index: number): FilaEjercicio {
  return {
    ejercicioId: ej.ejercicioId,
    series: Number(ej.series) || 3,
    repeticiones: Number(ej.repeticiones) || 10,
    descanso: normalizarDescanso(ej.descanso),
    orden: typeof ej.orden === "number" ? ej.orden : index,
  };
}

/**
 * Sincroniza los ejercicios de una rutina con la lista recibida, tocando SOLO lo que cambió
 * (P-43, D-61): borra los que ya no están, crea los nuevos y actualiza los que cambiaron.
 *
 * Antes se borraba y recreaba todo, lo que renovaba `EjercicioEnRutina.updatedAt` de todas las
 * filas con cualquier edición (incluso del nombre). El motor de progresión (D-59) usa ese campo
 * como "cuándo cambió el plan" y no juzga las sesiones anteriores, así que editar una rutina
 * hacía que un socio que lo cumplía todo viera "mantené" en vez de "subí".
 *
 * Por eso `updatedAt` significa acá "último cambio de series o repeticiones". Si solo cambió el
 * descanso o el orden (por ejemplo, reordenar), el plan no cambió y se fija el valor anterior,
 * porque Prisma renovaría `@updatedAt` con cualquier escritura.
 */
async function sincronizarEjercicios(
  tx: Prisma.TransactionClient,
  rutinaId: string,
  entrada: EjercicioEnRutinaInput[]
): Promise<void> {
  const deseadas = entrada.map(normalizarEjercicio);
  const idsDeseados = new Set(deseadas.map((d) => d.ejercicioId));
  // NF-11: la unique [rutinaId, ejercicioId] no admite el mismo ejercicio dos veces.
  if (idsDeseados.size !== deseadas.length) throwDuplicateExercise();

  const existentes = await tx.ejercicioEnRutina.findMany({ where: { rutinaId } });
  const porId = new Map(existentes.map((e) => [e.ejercicioId, e]));

  const sobrantes = existentes.filter((e) => !idsDeseados.has(e.ejercicioId));
  if (sobrantes.length > 0) {
    await tx.ejercicioEnRutina.deleteMany({
      where: { rutinaId, ejercicioId: { in: sobrantes.map((e) => e.ejercicioId) } },
    });
  }

  for (const deseada of deseadas) {
    const actual = porId.get(deseada.ejercicioId);
    if (!actual) continue;
    const cambioElPlan =
      actual.series !== deseada.series || actual.repeticiones !== deseada.repeticiones;
    const cambioOtraCosa = actual.descanso !== deseada.descanso || actual.orden !== deseada.orden;
    if (!cambioElPlan && !cambioOtraCosa) continue;

    await tx.ejercicioEnRutina.update({
      where: { rutinaId_ejercicioId: { rutinaId, ejercicioId: deseada.ejercicioId } },
      data: {
        series: deseada.series,
        repeticiones: deseada.repeticiones,
        descanso: deseada.descanso,
        orden: deseada.orden,
        ...(cambioElPlan ? {} : { updatedAt: actual.updatedAt }),
      },
    });
  }

  const nuevas = deseadas.filter((d) => !porId.has(d.ejercicioId));
  if (nuevas.length > 0) {
    try {
      await tx.ejercicioEnRutina.createMany({
        data: nuevas.map((d) => ({ rutinaId, ...d })),
      });
    } catch (error) {
      if (esErrorP2002(error)) throwDuplicateExercise();
      throw error;
    }
  }
}

/**
 * Handle POST /api/rutinas
 * Creates a new rutina with optional EjercicioEnRutina rows
 */
export async function handleRutinaCreate(
  data: RutinaInput & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const rutinaRepo = new RutinaRepository();
  // Import diferido: este módulo llega al navegador por los helpers `fetch*`, no puede
  // arrastrar Prisma de forma estática. Solo los handlers de servidor tocan la base.
  const { prisma } = await import("@/lib/db");

  // NF-2: la rutina y sus ejercicios son un único estado acoplado. Si `createMany`
  // falla, la rutina no debe quedar creada: se escriben en UNA transacción.
  return prisma.$transaction(async (tx) => {
    const rutina = await rutinaRepo.create(
      {
        nombre: data.nombre,
        frecuenciaSemanal: data.frecuenciaSemanal,
        duracionEstimada: data.duracionEstimada,
        nivelDeDificultad: data.nivelDeDificultad,
        descripcion: data.descripcion,
        objetivoPrincipal: data.objetivoPrincipal,
      },
      tx
    );

    // Persist ejercicios if provided
    if (data.ejercicios && data.ejercicios.length > 0) {
      try {
        await tx.ejercicioEnRutina.createMany({
          data: data.ejercicios.map(normalizarEjercicio).map((f) => ({ rutinaId: rutina.id, ...f })),
        });
      } catch (error) {
        if (esErrorP2002(error)) throwDuplicateExercise();
        throw error;
      }
    }

    return rutina;
  });
}

/**
 * Handle GET /api/rutinas
 * Lists all rutinas with exercise count (for ListPanel)
 */
export async function handleRutinaList(): Promise<RutinaWithCount[]> {
  const { prisma } = await import("@/lib/db");
  return prisma.rutina.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { ejercicios: true } } },
  });
}

/**
 * Handle GET /api/rutinas/:id
 * Retrieves a single rutina by ID with exercises ordered and their catalog data
 * (so the client can render the exercise name in the edit form).
 */
export async function handleRutinaGet(
  id: string
): Promise<
  (Rutina & { ejercicios: (EjercicioEnRutina & { ejercicio: Ejercicio })[] }) | null
> {
  const { prisma } = await import("@/lib/db");
  return prisma.rutina.findUnique({
    where: { id },
    include: {
      ejercicios: {
        orderBy: {
          orden: "asc",
        },
        include: { ejercicio: true },
      },
    },
  });
}

/**
 * Handle PUT /api/rutinas/:id
 * Updates a rutina and synchronizes EjercicioEnRutina rows if provided
 */
export async function handleRutinaUpdate(
  id: string,
  data: Partial<RutinaInput> & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina | null> {
  const rutinaRepo = new RutinaRepository();
  const { prisma } = await import("@/lib/db");

  // NF-2: el update de la rutina y la sincronización de ejercicios (borrar, crear y
  // actualizar lo que cambió) son un único estado acoplado: van en UNA transacción para que un fallo intermedio
  // no deje la rutina actualizada sin sus ejercicios (ni al revés).
  return prisma.$transaction(async (tx) => {
    const rutina = await rutinaRepo.update(
      id,
      {
        nombre: data.nombre,
        frecuenciaSemanal: data.frecuenciaSemanal,
        duracionEstimada: data.duracionEstimada,
        nivelDeDificultad: data.nivelDeDificultad,
        descripcion: data.descripcion,
        objetivoPrincipal: data.objetivoPrincipal,
      },
      tx
    );

    if (!rutina) return null;

    // Synchronize ejercicios if provided.
    //
    // CONTRACT (NF-1): `ejercicios === undefined` means "leave the subsection
    // untouched"; an empty array means "the user cleared every exercise". This
    // handler cannot tell a genuinely-cleared array from a never-loaded one, so
    // the invariant lives on the client: the edit form MUST always send the full
    // loaded array (see `fetchRutina` + RutinasPage.handleModify). Do not send
    // `[]` as a placeholder for "not loaded" — that would wipe the rows.
    if (data.ejercicios !== undefined) {
      await sincronizarEjercicios(tx, id, data.ejercicios);
    }

    return rutina;
  });
 }

/**
 * Handle DELETE /api/rutinas/:id
 * Deletes a rutina with cascade delete guard
 *
 * Business logic:
 * 1. Check if Rutina is assigned to any active Socio (RutinaAsignada.activa = true)
 * 2. If assigned: throw error "Rutina asignada activamente a N socio(s)"
 * 3. If not assigned: delete Rutina + all EjercicioEnRutina rows (Prisma cascade)
 */
export async function handleRutinaDelete(id: string): Promise<void> {
  const { prisma } = await import("@/lib/db");

  // Check if rutina exists
  const rutina = await prisma.rutina.findUnique({ where: { id } });
  if (!rutina) {
    throw new Error("NOT_FOUND");
  }

  // Check for active assignments
  const activeAssignments = await prisma.rutinaAsignada.count({
    where: {
      rutinaId: id,
      activa: true,
    },
  });

  if (activeAssignments > 0) {
    throw new Error(
      `DELETE_BLOCKED_ASSIGNED: Rutina asignada activamente a ${activeAssignments} socio(s)`
    );
  }

  // NF-6: una asignación INACTIVA puede estar referenciada por SesionDeEntrenamiento
  // (FK `onDelete: Restrict`). Al borrar la rutina, su asignación cascadea y el FK
  // revienta con P2003 → 500. Se bloquea explícitamente antes de tocar la DB.
  const historicalAssignments = await prisma.rutinaAsignada.count({
    where: {
      rutinaId: id,
      sesiones: { some: {} },
    },
  });

  if (historicalAssignments > 0) {
    throw new Error(
      `DELETE_BLOCKED_ASSIGNED: No se puede eliminar la rutina porque ${historicalAssignments} asignación(es) tienen sesiones de entrenamiento históricas`
    );
  }

  // Delete rutina (cascade deletes ejercicios)
  try {
    await prisma.rutina.delete({ where: { id } });
  } catch (error) {
    // Red de seguridad ante una carrera: si igual se llega al FK, nunca un 500 crudo.
    if ((error as { code?: unknown } | null)?.code === "P2003") {
      throw Object.assign(
        new Error(
          "DELETE_BLOCKED_ASSIGNED: No se puede eliminar la rutina porque tiene asignaciones con sesiones de entrenamiento históricas"
        ),
        { code: "DELETE_BLOCKED_ASSIGNED" }
      );
    }
    throw error;
  }
}

/**
 * Client-side API call: fetch all rutinas
 */
export function fetchRutinas(): Promise<RutinaWithCount[]> {
  return conCache(CLAVES.rutinas, async () => {
    const response = await fetch("/api/rutinas");
    await throwIfNotOk(response, "No se pudieron cargar las rutinas");
    return response.json();
  });
}

/**
 * Client-side API call: fetch a single rutina with its exercises (ordered by
 * `orden`) shaped as `EjercicioEnRutinaRow`, so the edit form can render them
 * and re-submit the full subsection instead of wiping it.
 */
export async function fetchRutina(id: string): Promise<RutinaDetalle> {
  const response = await fetch(`/api/rutinas/${id}`);
  await throwIfNotOk(response, "No se pudo cargar la rutina");
  const rutina: Rutina & { ejercicios?: EjercicioEnRutinaApiRow[] } =
    await response.json();

  return {
    ...rutina,
    ejercicios: (rutina.ejercicios ?? []).map((row) => ({
      ejercicioId: row.ejercicioId,
      ejercicioNombre: row.ejercicio?.nombre ?? "",
      series: row.series,
      repeticiones: row.repeticiones,
      descanso: row.descanso,
      orden: row.orden,
    })),
  };
}

/**
 * Client-side API call: create a new rutina
 */
export async function createRutina(
  data: RutinaInput & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const response = await fetch("/api/rutinas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  await throwIfNotOk(response, "No se pudo crear la rutina");
  invalidarCache(CLAVES.rutinas, CLAVES.ejercicios);
  return response.json();
}

/**
 * Client-side API call: update a rutina
 */
export async function updateRutina(
  id: string,
  data: Partial<RutinaInput> & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const response = await fetch(`/api/rutinas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  await throwIfNotOk(response, "No se pudo actualizar la rutina");
  invalidarCache(CLAVES.rutinas, CLAVES.ejercicios);
  return response.json();
}

/**
 * Client-side API call: delete a rutina
 */
export async function deleteRutina(id: string): Promise<void> {
  const response = await fetch(`/api/rutinas/${id}`, {
    method: "DELETE",
  });

  await throwIfNotOk(response, "No se pudo eliminar la rutina");
  invalidarCache(CLAVES.rutinas, CLAVES.ejercicios);
}
