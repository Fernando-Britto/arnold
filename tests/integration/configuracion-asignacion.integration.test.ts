import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getConfiguracion } from "@/lib/configuracion";

/** Migraciones de la Etapa 4: se leen del disco para probar que son aditivas. */
const MIGRACION_TABLA = path.resolve(
  __dirname,
  "../../prisma/migrations/20261026120000_asignacion_ejercicio/migration.sql"
);
const MIGRACION_CONFIGURACION = path.resolve(
  __dirname,
  "../../prisma/migrations/20261026120500_asignacion_configuracion/migration.sql"
);

function sqlSinComentarios(archivo: string): string {
  return fs
    .readFileSync(archivo, "utf8")
    .split("\n")
    .filter((linea) => !linea.trim().startsWith("--"))
    .join("\n");
}

describe("migraciones de la Etapa 4 contra Postgres real", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("aplica las dos migraciones desde cero y crea la tabla con sus índices y FKs", async () => {
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'AsignacionDeEjercicio'
    `;
    expect(tablas).toHaveLength(1);

    const indices = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'AsignacionDeEjercicio'
        AND indexname <> 'AsignacionDeEjercicio_pkey'
      ORDER BY indexname
    `;
    expect(indices.map((i) => i.indexname)).toEqual([
      "AsignacionDeEjercicio_ejercicioId_idx",
      "AsignacionDeEjercicio_maquinaId_estado_creadaEn_idx",
      "AsignacionDeEjercicio_sesionId_idx",
      "AsignacionDeEjercicio_socioId_estado_venceEn_idx",
    ]);

    // confdeltype: c = CASCADE, n = SET NULL
    const fks = await prisma.$queryRaw<{ conname: string; confdeltype: string }[]>`
      SELECT conname, confdeltype
      FROM pg_constraint
      WHERE conrelid = '"AsignacionDeEjercicio"'::regclass AND contype = 'f'
      ORDER BY conname
    `;
    expect(fks.map((f) => [f.conname, f.confdeltype])).toEqual([
      ["AsignacionDeEjercicio_ejercicioId_fkey", "c"],
      ["AsignacionDeEjercicio_maquinaId_fkey", "n"],
      ["AsignacionDeEjercicio_sesionId_fkey", "n"],
      ["AsignacionDeEjercicio_socioId_fkey", "c"],
    ]);
  });

  it("ConfiguracionDelSistema recibe 60/15/30 y conserva el resto de la fila", async () => {
    const fila = await prisma.configuracionDelSistema.create({
      data: {
        capacidadMaxima: 120,
        periodoGracia: 0,
        diasInactividad: 15,
        descuentoReactivacion: 0,
        antiPassbackMinutos: 45,
      },
      select: {
        id: true,
        segundosEjecucionSerie: true,
        minutosVencimientoReserva: true,
        minutosInactividadSesion: true,
      },
    });

    try {
      expect(fila.segundosEjecucionSerie).toBe(60);
      expect(fila.minutosVencimientoReserva).toBe(15);
      expect(fila.minutosInactividadSesion).toBe(30);

      const config = await getConfiguracion();
      expect(config.capacidadMaxima).toBe(120);
      expect(config.antiPassbackMinutos).toBe(45);
      expect(config.segundosEjecucionSerie).toBe(60);
      expect(config.minutosVencimientoReserva).toBe(15);
      expect(config.minutosInactividadSesion).toBe(30);
    } finally {
      await prisma.configuracionDelSistema.delete({ where: { id: fila.id } });
    }
  });

  it("la migración de la tabla es aditiva y no tiene DROP ni ALTER ejecutables", async () => {
    const sql = sqlSinComentarios(MIGRACION_TABLA);

    expect(sql).toContain('CREATE TABLE "AsignacionDeEjercicio"');
    expect(sql).toContain('CREATE TYPE "EstadoAsignacion"');
    expect(sql.match(/CREATE INDEX/g)).toHaveLength(4);
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/\bALTER\b/);
  });

  it("la migración de configuración es aditiva y documenta el rollback", async () => {
    const sql = fs.readFileSync(MIGRACION_CONFIGURACION, "utf8");

    expect(sql).toContain('ADD COLUMN "segundosEjecucionSerie" INTEGER NOT NULL DEFAULT 60');
    expect(sql).toContain('ADD COLUMN "minutosVencimientoReserva" INTEGER NOT NULL DEFAULT 15');
    expect(sql).toContain('ADD COLUMN "minutosInactividadSesion" INTEGER NOT NULL DEFAULT 30');
    expect(sql).toContain('DROP COLUMN IF EXISTS "segundosEjecucionSerie"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "minutosVencimientoReserva"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "minutosInactividadSesion"');
  });
});
