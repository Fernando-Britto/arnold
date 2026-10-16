import type {
  NivelDeDificultad,
  Prisma,
  Rutina as PrismaRutina,
} from "@prisma/client";
import {
  DEFAULT_OBJETIVO_PRINCIPAL,
  mapNivelDeDificultad,
  validateRutina,
} from "./rutina";

/**
 * Acceso a datos de Rutina. Separado del dominio puro (`./rutina`) para que la lógica de
 * negocio quede libre de Prisma y del edge estático con `@/lib/db`.
 *
 * `RutinaReader` declara SOLO los métodos del delegate que este repositorio usa. Existe para
 * inyectar el cliente (o una transacción) y poder testear sin Prisma, igual que `OfertaReader`
 * en `src/domains/pago/oferta-reactivacion-consulta.ts`. El default es diferido
 * (`await import("@/lib/db")`): este módulo lo importa la capa API que también llega al navegador
 * (los helpers `fetch*` de `src/api/rutinas.ts`), así que no puede arrastrar Prisma de forma estática.
 */
export interface RutinaReader {
  rutina: {
    create(args: {
      data: {
        nombre: string;
        frecuenciaSemanal: number;
        duracionEstimada: number;
        nivelDeDificultad: NivelDeDificultad;
        descripcion?: string | null;
        objetivoPrincipal: string;
      };
    }): Promise<PrismaRutina>;
    findUnique(args: { where: { id: string } }): Promise<PrismaRutina | null>;
    update(args: {
      where: { id: string };
      data: Prisma.RutinaUncheckedUpdateInput;
    }): Promise<PrismaRutina>;
    delete(args: { where: { id: string } }): Promise<PrismaRutina>;
  };
}

/** Carga diferida del cliente real. Ver el comentario de `RutinaReader`. */
async function getPrisma(): Promise<RutinaReader> {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

/**
 * Rutina Repository for database operations
 */
export class RutinaRepository {
  /**
    * Create a new rutina in the database.
    *
    * `client` defaults to the lazily-loaded module Prisma client, but callers that must
    * couple this write with others (p. ej. `EjercicioEnRutina`) pass the transaction client
    * `tx` so both writes commit or roll back together.
    */
  async create(
    data: {
      nombre: string;
      frecuenciaSemanal: number;
      duracionEstimada: number;
      nivelDeDificultad: string;
      descripcion?: string | null;
      objetivoPrincipal?: string;
    },
    client?: RutinaReader
  ): Promise<PrismaRutina> {
    // Validate first
    const validation = validateRutina(data);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
    }

    // Create in database
    const db = client ?? (await getPrisma());
    return db.rutina.create({
      data: {
        nombre: data.nombre,
        frecuenciaSemanal: data.frecuenciaSemanal,
        duracionEstimada: data.duracionEstimada,
        nivelDeDificultad: mapNivelDeDificultad(data.nivelDeDificultad),
        descripcion: data.descripcion,
        objetivoPrincipal: data.objetivoPrincipal || DEFAULT_OBJETIVO_PRINCIPAL,
      },
    });
  }

  /**
    * Retrieve a rutina by ID
    */
  async getById(id: string, client?: RutinaReader): Promise<PrismaRutina | null> {
    const db = client ?? (await getPrisma());
    return db.rutina.findUnique({
      where: { id },
    });
  }

  /**
   * Update a rutina.
   *
   * `client` defaults to the lazily-loaded module Prisma client; callers that synchronize
   * the exercises inside the same transaction pass `tx` so the read-for-validation, the
   * update and the exercise sync share one atomic boundary.
   */
  async update(
    id: string,
    data: Partial<{
      nombre: string;
      frecuenciaSemanal: number;
      duracionEstimada: number;
      nivelDeDificultad: string;
      descripcion: string | null;
      objetivoPrincipal: string | null;
    }>,
    client?: RutinaReader
  ): Promise<PrismaRutina | null> {
    const db = client ?? (await getPrisma());

    // Validate if updating validation fields
    if (
      data.nombre !== undefined ||
      data.frecuenciaSemanal !== undefined ||
      data.duracionEstimada !== undefined ||
      data.nivelDeDificultad !== undefined ||
      data.objetivoPrincipal !== undefined
    ) {
      const current = await db.rutina.findUnique({ where: { id } });
      if (!current) return null;

      const merged = { ...current, ...data };
      const validation = validateRutina(merged);
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(", ")}`);
      }
    }

    // Map nivel de dificultad if provided and filter out undefined null values
    // NF-14: contrato de campos opcionales: `undefined` = no cambiar, `null` = vaciar.
    // `descripcion` es nullable, así que un `null` explícito limpia la columna.
    const updateData: Prisma.RutinaUncheckedUpdateInput = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.frecuenciaSemanal !== undefined) updateData.frecuenciaSemanal = data.frecuenciaSemanal;
    if (data.duracionEstimada !== undefined) updateData.duracionEstimada = data.duracionEstimada;
    if (data.nivelDeDificultad !== undefined) updateData.nivelDeDificultad = mapNivelDeDificultad(data.nivelDeDificultad);
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    // `objetivoPrincipal` es NOT NULL en la base: un `null` (o no-string) es dato inválido que
    // `validateRutina` ya rechazó arriba, así que sólo se escribe un string real.
    if (typeof data.objetivoPrincipal === "string") updateData.objetivoPrincipal = data.objetivoPrincipal;

    return db.rutina.update({
      where: { id },
      data: updateData,
    });
  }

  /**
    * Delete a rutina
    */
  async delete(id: string, client?: RutinaReader): Promise<PrismaRutina> {
    const db = client ?? (await getPrisma());
    return db.rutina.delete({
      where: { id },
    });
  }
}
