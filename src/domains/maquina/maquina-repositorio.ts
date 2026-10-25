import type { Maquina, Prisma } from "@prisma/client";
import type {
  EjercicioAsociado,
  EstadoAsignable,
  EstadoMaquina,
  TipoEquipamiento,
} from "./maquina";

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
  ejercicioMaquina: {
    count(args: { where: { maquinaId: string } }): Promise<number>;
    findMany(args: {
      where: { maquinaId: string };
      include: { ejercicio: { select: { id: true; nombre: true; grupoMuscular: true } } };
      orderBy: { ejercicio: { nombre: "asc" } };
    }): Promise<Array<{ ejercicio: EjercicioAsociado }>>;
    deleteMany(args: { where: { maquinaId: string } }): Promise<{ count: number }>;
    createMany(args: {
      data: Array<{ maquinaId: string; ejercicioId: string }>;
    }): Promise<{ count: number }>;
  };
  ejercicio: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
  $transaction<T>(fn: (tx: MaquinaReader) => Promise<T>): Promise<T>;
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
      estado?: EstadoMaquina;
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

  async contarEjerciciosAsociados(maquinaId: string, db?: MaquinaReader): Promise<number> {
    const cliente = db ?? (await getPrisma());
    return cliente.ejercicioMaquina.count({ where: { maquinaId } });
  }

  async obtenerEjerciciosExistentes(
    ejercicioIds: string[],
    db?: MaquinaReader
  ): Promise<ReadonlySet<string>> {
    if (ejercicioIds.length === 0) return new Set();
    const cliente = db ?? (await getPrisma());
    const filas = await cliente.ejercicio.findMany({
      where: { id: { in: ejercicioIds } },
      select: { id: true },
    });
    return new Set(filas.map((fila) => fila.id));
  }

  // Deliberately cannot distinguish "missing machine" from "empty set": the handler owns the 404.
  async getEjerciciosAsociados(
    maquinaId: string,
    db?: MaquinaReader
  ): Promise<EjercicioAsociado[]> {
    const cliente = db ?? (await getPrisma());
    return this.leerAsociados(cliente, maquinaId);
  }

  async reemplazarEjerciciosAsociados(
    maquinaId: string,
    ejercicioIds: string[],
    db?: MaquinaReader
  ): Promise<EjercicioAsociado[]> {
    const cliente = db ?? (await getPrisma());
    return cliente.$transaction(async (tx) => {
      await tx.ejercicioMaquina.deleteMany({ where: { maquinaId } });
      if (ejercicioIds.length > 0) {
        await tx.ejercicioMaquina.createMany({
          data: ejercicioIds.map((ejercicioId) => ({ maquinaId, ejercicioId })),
        });
      }
      return this.leerAsociados(tx, maquinaId);
    });
  }

  private async leerAsociados(
    cliente: MaquinaReader,
    maquinaId: string
  ): Promise<EjercicioAsociado[]> {
    const filas = await cliente.ejercicioMaquina.findMany({
      where: { maquinaId },
      include: {
        ejercicio: { select: { id: true, nombre: true, grupoMuscular: true } },
      },
      orderBy: { ejercicio: { nombre: "asc" } },
    });
    return filas.map((fila) => fila.ejercicio);
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
