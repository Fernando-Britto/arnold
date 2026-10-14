import { Ejercicio, EjercicioEnRutina, Rutina } from "@prisma/client";
import { RutinaRepository, validateRutina } from "@/domains/rutina/rutina";
import { prisma } from "@/lib/db";
import { throwIfNotOk } from "@/utils/api-error";
import type { EjercicioEnRutinaRow } from "@/components/rutina-crud/ejercicio-en-rutina-list";

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
  descripcion?: string;
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

/**
 * Handle POST /api/rutinas
 * Creates a new rutina with optional EjercicioEnRutina rows
 */
export async function handleRutinaCreate(
  data: RutinaInput & { ejercicios?: EjercicioEnRutinaInput[] }
): Promise<Rutina> {
  const rutinaRepo = new RutinaRepository();

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
          data: data.ejercicios.map((ej, index) => ({
            rutinaId: rutina.id,
            ejercicioId: ej.ejercicioId,
            series: Number(ej.series) || 3,
            repeticiones: Number(ej.repeticiones) || 10,
            descanso: normalizarDescanso(ej.descanso),
            orden: typeof ej.orden === "number" ? ej.orden : index,
          })),
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

  // NF-2: el update de la rutina y la sincronización de ejercicios (delete + recreate)
  // son un único estado acoplado: van en UNA transacción para que un fallo intermedio
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
      // Delete existing ejercicios for this rutina
      await tx.ejercicioEnRutina.deleteMany({
        where: { rutinaId: id },
      });

      // Create new ejercicios if provided
      if (data.ejercicios.length > 0) {
        try {
          await tx.ejercicioEnRutina.createMany({
            data: data.ejercicios.map((ej, index) => ({
              rutinaId: id,
              ejercicioId: ej.ejercicioId,
              series: Number(ej.series) || 3,
              repeticiones: Number(ej.repeticiones) || 10,
              descanso: normalizarDescanso(ej.descanso),
              orden: typeof ej.orden === "number" ? ej.orden : index,
            })),
          });
        } catch (error) {
          if (esErrorP2002(error)) throwDuplicateExercise();
          throw error;
        }
      }
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
export async function fetchRutinas(): Promise<RutinaWithCount[]> {
  const response = await fetch("/api/rutinas");
  await throwIfNotOk(response, "No se pudieron cargar las rutinas");
  return response.json();
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
}
