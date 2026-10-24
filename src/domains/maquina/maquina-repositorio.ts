import type { Maquina, Prisma } from "@prisma/client";
import type { EstadoAsignable, TipoEquipamiento } from "./maquina";

export interface MaquinaReader {
  maquina: {
    create(args: { data: Prisma.MaquinaCreateInput }): Promise<Maquina>;
    findUnique(args: { where: { id: string } }): Promise<Maquina | null>;
    findMany(args?: {
      where?: Prisma.MaquinaWhereInput;
      orderBy?: { nombre: "asc" };
    }): Promise<Maquina[]>;
    update(args: {
      where: { id: string };
      data: Prisma.MaquinaUpdateInput;
    }): Promise<Maquina>;
    delete(args: { where: { id: string } }): Promise<Maquina>;
  };
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
}

async function getPrisma(): Promise<MaquinaReader> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as MaquinaReader;
}

function duplicateError(): Error {
  return Object.assign(
    new Error(
      "DUPLICATE_NOMBRE_UBICACION: Ya existe una máquina con el mismo nombre y ubicación"
    ),
    { code: "DUPLICATE_NOMBRE_UBICACION" }
  );
}

export function esErrorP2002(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

export interface MaquinaCreateInput {
  nombre: string;
  ubicacion: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoAsignable;
}

export class MaquinaRepository {
  async create(data: MaquinaCreateInput, db?: MaquinaReader): Promise<Maquina> {
    const cliente = db ?? (await getPrisma());
    if (await this.existeDuplicado(data.nombre, data.ubicacion, undefined, cliente)) {
      throw duplicateError();
    }
    try {
      return await cliente.maquina.create({ data });
    } catch (error) {
      if (esErrorP2002(error)) throw duplicateError();
      throw error;
    }
  }

  async getById(id: string, db?: MaquinaReader): Promise<Maquina | null> {
    const cliente = db ?? (await getPrisma());
    return cliente.maquina.findUnique({ where: { id } });
  }

  async getAll(
    filters: {
      estado?: EstadoAsignable;
      tipoEquipamiento?: TipoEquipamiento;
      nombre?: string;
    } = {},
    db?: MaquinaReader
  ): Promise<Maquina[]> {
    const cliente = db ?? (await getPrisma());
    const where: Prisma.MaquinaWhereInput = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.tipoEquipamiento) where.tipoEquipamiento = filters.tipoEquipamiento;
    if (filters.nombre) {
      where.nombre = { contains: filters.nombre, mode: "insensitive" };
    }
    return cliente.maquina.findMany({ where, orderBy: { nombre: "asc" } });
  }

  async update(
    id: string,
    data: MaquinaCreateInput,
    db?: MaquinaReader
  ): Promise<Maquina> {
    const cliente = db ?? (await getPrisma());
    if (await this.existeDuplicado(data.nombre, data.ubicacion, id, cliente)) {
      throw duplicateError();
    }
    try {
      return await cliente.maquina.update({ where: { id }, data });
    } catch (error) {
      // shortcut: a second unique field would need meta.target disambiguation, revisit when one exists
      if (esErrorP2002(error)) throw duplicateError();
      throw error;
    }
  }

  async delete(id: string, db?: MaquinaReader): Promise<Maquina> {
    const cliente = db ?? (await getPrisma());
    return cliente.maquina.delete({ where: { id } });
  }

  async existeDuplicado(
    nombre: string,
    ubicacion: string,
    excluirId: string | undefined,
    db?: MaquinaReader
  ): Promise<boolean> {
    const cliente = db ?? (await getPrisma());
    const { Prisma } = await import("@prisma/client");
    const excluido = excluirId
      ? Prisma.sql`AND "id" <> ${excluirId}`
      : Prisma.empty;
    const filas = await cliente.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT 1 AS n FROM "Maquina"
      WHERE  unaccent(lower(btrim("nombre")))    = unaccent(lower(btrim(${nombre})))
        AND  unaccent(lower(btrim("ubicacion"))) = unaccent(lower(btrim(${ubicacion})))
        ${excluido}
      LIMIT 1
    `);
    return filas.length > 0;
  }
}

export const maquinaRepository = new MaquinaRepository();
