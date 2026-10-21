import { EjercicioRepository, type EjercicioReader } from "./ejercicio-repositorio";

/**
 * D-70: las instrucciones son el 66 % del peso del catálogo (690 de 1.050 KB). El listado no las
 * necesita (se ven al abrir un ejercicio), así que `getAll` no las trae y `getById` sí.
 */
function dbFalsa() {
  const findMany = jest.fn().mockResolvedValue([]);
  const findUnique = jest.fn().mockResolvedValue(null);
  const $queryRaw = jest.fn().mockResolvedValue([]);
  const db = {
    ejercicio: { create: jest.fn(), findUnique, findMany, update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    $queryRaw,
  } as unknown as EjercicioReader;
  return { db, findMany, findUnique, $queryRaw };
}

describe("EjercicioRepository: listado liviano (sin instrucciones)", () => {
  const repo = new EjercicioRepository();

  it("sin búsqueda, findMany omite las instrucciones", async () => {
    const { db, findMany } = dbFalsa();
    await repo.getAll(undefined, db);
    expect(findMany.mock.calls[0][0]).toMatchObject({ omit: { instrucciones: true } });
  });

  it("con búsqueda, el SQL crudo no selecciona las instrucciones pero sí lo que usa el listado", async () => {
    const { db, $queryRaw } = dbFalsa();
    await repo.getAll({ search: "curl" }, db);
    const { sql } = $queryRaw.mock.calls[0][0] as { sql: string };
    expect(sql).not.toMatch(/instrucciones/);
    expect(sql).not.toMatch(/SELECT\s+\*/);
    for (const columna of ["id", "nombre", "grupoMuscular", "descripcion", "equipamiento", "musculoObjetivo", "musculosSecundarios", "mediaId", "datasetId"]) {
      expect(sql).toContain(`"${columna}"`);
    }
    expect(sql).toContain('AS "enRutinas"');
  });

  it("getById sigue trayendo el ejercicio completo (con instrucciones)", async () => {
    const { db, findUnique } = dbFalsa();
    await repo.getById("e1", db);
    expect(findUnique.mock.calls[0][0]).not.toHaveProperty("omit");
  });
});
