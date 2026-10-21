import type { Ejercicio, Prisma } from "@prisma/client";
import { validateEjercicio, type EjercicioConUso, type EjercicioInput } from "./ejercicio";

/**
 * Acceso a datos de Ejercicio. Separado del dominio puro (`./ejercicio`) para que la lógica
 * de negocio quede libre de Prisma y del edge estático con `@/lib/db`.
 *
 * `EjercicioReader` declara SOLO los métodos del delegate que este repositorio usa. Existe para
 * inyectar el cliente (o una transacción) y poder testear sin Prisma, igual que `OfertaReader`
 * en `src/domains/pago/oferta-reactivacion-consulta.ts`. El default es diferido
 * (`await import("@/lib/db")`): este módulo lo importan capas que también llegan al navegador,
 * así que no puede arrastrar Prisma de forma estática.
 */
export interface EjercicioReader {
  ejercicio: {
    create(args: {
      data: { nombre: string; grupoMuscular: string; descripcion: string | null };
    }): Promise<Ejercicio>;
    findUnique(args: { where: { id: string } }): Promise<Ejercicio | null>;
    findMany(args?: {
      where?: { grupoMuscular?: string };
      orderBy?: { nombre: "asc" | "desc" };
      include?: { _count: { select: { rutinas: true } } };
      omit?: { instrucciones: true };
    }): Promise<Ejercicio[]>;
    update(args: {
      where: { id: string };
      data: Partial<{ nombre: string; grupoMuscular: string; descripcion: string | null }>;
    }): Promise<Ejercicio>;
    delete(args: { where: { id: string } }): Promise<Ejercicio>;
    count(): Promise<number>;
  };
  /** Consulta cruda para la búsqueda con tildes (H12). Ver `getAll`. */
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
}

/** Cliente con transacción interactiva: `update` necesita leer y escribir en la misma transacción. */
export interface EjercicioDb extends EjercicioReader {
  $transaction<T>(fn: (tx: EjercicioReader) => Promise<T>): Promise<T>;
}

/**
 * Columnas del listado: todas menos `instrucciones` (D-70). Si se agrega una columna a `Ejercicio`
 * que el listado necesite, hay que sumarla acá (la consulta con búsqueda es SQL crudo y no puede
 * "omitir" una columna como `findMany`). Se arma con `Prisma.raw` en `getAll`.
 */
const COLUMNAS = [
  "id", "nombre", "grupoMuscular", "descripcion", "createdAt", "updatedAt",
  "datasetId", "equipamiento", "musculoObjetivo", "musculosSecundarios", "mediaId",
] as const;

/** Carga diferida del cliente real. Ver el comentario de `EjercicioReader`. */
async function getPrisma(): Promise<EjercicioDb> {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

/**
 * Mensaje del bloqueo por clave foránea al borrar un ejercicio (H11). Prisma informa en
 * `error.meta` la relación que restringe (el nombre del constraint contiene el modelo):
 * `EjercicioEnRutina` (está en rutinas) o `RegistroDeProgreso` (tiene historial). Si el
 * meta falta o no se reconoce, el mensaje cubre las dos relaciones posibles.
 */
function mensajeBloqueoPorRelacion(error: { meta?: unknown } | null | undefined): string {
  const meta = JSON.stringify(error?.meta ?? "");
  if (/EjercicioEnRutina/.test(meta)) {
    return "No se puede eliminar el ejercicio porque está asignado a una o más rutinas";
  }
  if (/RegistroDeProgreso/.test(meta)) {
    return "No se puede eliminar el ejercicio porque tiene historial de entrenamiento";
  }
  return "No se puede eliminar el ejercicio porque está en uso";
}

/**
 * Repository for Ejercicio domain operations
 * Handles persistence and retrieval from the database
 */
export class EjercicioRepository {
  /**
   * Create a new ejercicio
   * @param data Ejercicio input
   * @param db Cliente inyectado (opcional); sin él usa el cliente real cargado de forma diferida.
   * @returns Created ejercicio with ID
   * @throws Error if validation fails
   */
  async create(data: EjercicioInput, db?: EjercicioReader): Promise<Ejercicio> {
    const validation = validateEjercicio(data);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
    }

    const cliente = db ?? (await getPrisma());
    return cliente.ejercicio.create({
      data: {
        nombre: data.nombre,
        grupoMuscular: data.grupoMuscular,
        descripcion: data.descripcion || null,
      },
    });
  }

  /**
   * Get ejercicio by ID
   * @param id Ejercicio ID
   * @param db Cliente inyectado (opcional).
   * @returns Ejercicio or null if not found
   */
  async getById(id: string, db?: EjercicioReader): Promise<Ejercicio | null> {
    const cliente = db ?? (await getPrisma());
    return cliente.ejercicio.findUnique({
      where: { id },
    });
  }

  /**
   * Get all ejercicios with optional filtering. Cada fila lleva `enRutinas`: cuántas rutinas
   * la referencian (`_count`), para que la UI anticipe el 409 al borrar.
   * Supports combined filters: search + muscleGroup simultaneously
   * @param options Optional filter options { muscleGroup?: string; search?: string }
   * @param db Cliente inyectado (opcional).
   * @returns Array of ejercicios (con su uso) matching filters
   */
  async getAll(
    options?: { muscleGroup?: string; search?: string },
    db?: EjercicioReader
  ): Promise<EjercicioConUso[]> {
    const cliente = db ?? (await getPrisma());

    if (options?.search) {
      // H12: `contains` + `insensitive` es el `ILIKE` de Postgres: pliega mayúsculas, pero NO
      // tildes ("triceps" no matcheaba "Tríceps"). Acá se pliegan las DOS partes con `unaccent`
      // (extensión creada por la migración 20261015200000_unaccent). El término va SIEMPRE como
      // parámetro (`$1`), nunca concatenado dentro del SQL.
      //
      // `unaccent()` no es IMMUTABLE, así que no puede respaldar un índice y esta búsqueda
      // escanea la tabla. Es aceptable para un catálogo de ejercicios de este tamaño.
      const { Prisma } = await import("@prisma/client");
      const patron = `%${options.search}%`;
      // Constante del módulo (no viene del usuario): por eso es seguro armarla como SQL literal.
      const columnas = Prisma.raw(COLUMNAS.map((c) => `"${c}"`).join(", "));
      const filtroGrupo = options.muscleGroup
        ? Prisma.sql`AND "grupoMuscular" = ${options.muscleGroup}`
        : Prisma.empty;

      return cliente.$queryRaw<EjercicioConUso[]>(Prisma.sql`
        SELECT ${columnas}, (
          SELECT COUNT(*)::int FROM "EjercicioEnRutina"
          WHERE "EjercicioEnRutina"."ejercicioId" = "Ejercicio"."id"
        ) AS "enRutinas"
        FROM "Ejercicio"
        WHERE unaccent("nombre") ILIKE unaccent(${patron})
        ${filtroGrupo}
        ORDER BY "nombre" ASC
      `);
    }

    // Sin `search`, Prisma alcanza: filtra por grupo (si lo hay), ordena por nombre y trae
    // el `_count` de rutinas para exponerlo como `enRutinas`.
    const where: { grupoMuscular?: string } = {};
    if (options?.muscleGroup) {
      where.grupoMuscular = options.muscleGroup;
    }

    const filas = (await cliente.ejercicio.findMany({
      where,
      orderBy: { nombre: "asc" },
      include: { _count: { select: { rutinas: true } } },
      omit: { instrucciones: true },
    })) as (Ejercicio & { _count: { rutinas: number } })[];
    return filas.map(({ _count, ...ejercicio }) => ({
      ...ejercicio,
      enRutinas: _count.rutinas,
    }));
  }

  /**
   * Update an ejercicio
   * @param id Ejercicio ID
   * @param data Partial ejercicio data to update
   * @param db Cliente inyectado (opcional); debe soportar transacción.
   * @returns Updated ejercicio or null if not found
   */
  async update(
    id: string,
    data: Partial<EjercicioInput>,
    db?: EjercicioDb
  ): Promise<Ejercicio | null> {
    // H-6: la lectura de validación y la escritura van en UNA sola transacción
    // para eliminar la ventana TOCTOU del read-then-write.
    const cliente = db ?? (await getPrisma());
    return cliente.$transaction(async (tx) => {
      const currentEjercicio = await tx.ejercicio.findUnique({ where: { id } });
      if (!currentEjercicio) return null;

      // Merge current data with updates to validate complete record
      const updateData = {
        ...currentEjercicio,
        ...data,
      };

      // Validate merged data (ensures no invalid partial updates)
      const validation = validateEjercicio(updateData);
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
      }

      return tx.ejercicio.update({
        where: { id },
        data: {
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.grupoMuscular !== undefined && { grupoMuscular: data.grupoMuscular }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
        },
      });
    });
  }

  /**
   * Delete an ejercicio
   * @param id Ejercicio ID
   * @param db Cliente inyectado (opcional).
   * @returns true if deleted, false if not found
   * @throws Error if ejercicio is in use (DELETE_BLOCKED_ASSIGNED)
   */
  async delete(id: string, db?: EjercicioReader): Promise<boolean> {
    const cliente = db ?? (await getPrisma());
    try {
      await cliente.ejercicio.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      // P2003: falla de clave foránea. Al ejercicio lo referencian DOS relaciones con
      // onDelete: Restrict: `EjercicioEnRutina.ejercicio` (asignado a rutinas) y
      // `RegistroDeProgreso.ejercicio` (historial de entrenamiento). Prisma informa cuál
      // en `error.meta` (nombre del constraint/campo), así que el mensaje se elige según
      // la relación (H11); sin meta reconocible, cae a un mensaje que cubre las dos.
      const err = error as { code?: string; message?: string; meta?: unknown };
      if (err.code === "P2003" || err.message?.includes("foreign key")) {
        throw Object.assign(
          new Error(`DELETE_BLOCKED_ASSIGNED: ${mensajeBloqueoPorRelacion(err)}`),
          { code: "DELETE_BLOCKED_ASSIGNED" }
        );
      }
      // P2025: record not found → false (404 handled by the caller).
      if (err.code === "P2025") {
        return false;
      }
      // H-3: cualquier otro fallo es de infraestructura y debe propagarse (→ 500),
      // no enmascararse como "no encontrado".
      throw error;
    }
  }

  /**
   * Count total ejercicios
   * @param db Cliente inyectado (opcional).
   * @returns Total count
   */
  async count(db?: EjercicioReader): Promise<number> {
    const cliente = db ?? (await getPrisma());
    return cliente.ejercicio.count();
  }
}

/**
 * Export a singleton repository instance
 */
export const ejercicioRepository = new EjercicioRepository();
