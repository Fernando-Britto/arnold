import type { DbFalso } from "../../../tests/factories/asignacion-db";
import { AHORA, crearDb, repo } from "../../../tests/factories/asignacion-db";

describe("AsignacionRepository: escrituras y advisory lock", () => {
  describe("escrituras y advisory lock", () => {
    it("cancelarReservasActivas filtra RESERVADA no vencida y devuelve count", async () => {
      const db = crearDb();
      db.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await repo(db).cancelarReservasActivas("socio-1", AHORA);

      expect(db.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
        where: { socioId: "socio-1", estado: "RESERVADA", venceEn: { gt: AHORA } },
        data: { estado: "CANCELADA" },
      });
      expect(resultado).toBe(1);
    });

    it("crearReserva escribe el snapshot y venceEn exactos", async () => {
      const db = crearDb();
      const venceEn = new Date("2026-10-26T10:15:00.000Z");

      const resultado = await repo(db).crearReserva({
        socioId: "socio-1",
        ejercicioId: "E1",
        maquinaId: "M1",
        esperaSegundos: 120,
        ahorroSegundos: 60,
        creadaEn: AHORA,
        venceEn,
      });

      expect(db.asignacionDeEjercicio.create).toHaveBeenCalledWith({
        data: {
          socioId: "socio-1",
          ejercicioId: "E1",
          maquinaId: "M1",
          estado: "RESERVADA",
          esperaSegundos: 120,
          ahorroSegundos: 60,
          creadaEn: AHORA,
          venceEn,
        },
        select: { id: true },
      });
      expect(resultado).toEqual({ id: "a-1" });
    });

    it("consumirReserva usa updateMany con guard de estado y vencimiento", async () => {
      const db = crearDb();
      db.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 1 });

      expect(await repo(db).consumirReserva("a-1", "s-1", AHORA)).toBe(true);
      expect(db.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
        where: { id: "a-1", estado: "RESERVADA", venceEn: { gt: AHORA } },
        data: { estado: "EN_CURSO", sesionId: "s-1" },
      });

      db.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 0 });
      expect(await repo(db).consumirReserva("a-1", "s-1", AHORA)).toBe(false);
    });

    it("cancelarReserva usa updateMany con guard", async () => {
      const db = crearDb();
      db.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 1 });

      expect(await repo(db).cancelarReserva("a-1", AHORA)).toBe(true);
      expect(db.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
        where: { id: "a-1", estado: "RESERVADA", venceEn: { gt: AHORA } },
        data: { estado: "CANCELADA" },
      });
    });

    it("completarEjecucion solo toca EN_CURSO", async () => {
      const db = crearDb();

      await repo(db).completarEjecucion("s-1", "E1");

      expect(db.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
        where: { sesionId: "s-1", ejercicioId: "E1", estado: "EN_CURSO" },
        data: { estado: "COMPLETADA" },
      });
    });

    it("completarEjecucionesDeSesion completa todas las EN_CURSO", async () => {
      const db = crearDb();

      await repo(db).completarEjecucionesDeSesion("s-1");

      expect(db.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
        where: { sesionId: "s-1", estado: "EN_CURSO" },
        data: { estado: "COMPLETADA" },
      });
    });

    it("crearEjecucionEnCurso escribe 0/0, sesionId y venceEn = ahora", async () => {
      const db = crearDb();

      await repo(db).crearEjecucionEnCurso({
        socioId: "socio-1",
        sesionId: "s-1",
        ejercicioId: "E1",
        maquinaId: "M1",
        ahora: AHORA,
      });

      expect(db.asignacionDeEjercicio.create).toHaveBeenCalledWith({
        data: {
          socioId: "socio-1",
          sesionId: "s-1",
          ejercicioId: "E1",
          maquinaId: "M1",
          estado: "EN_CURSO",
          esperaSegundos: 0,
          ahorroSegundos: 0,
          creadaEn: AHORA,
          venceEn: AHORA,
        },
        select: { id: true },
      });
    });

    it("enTransaccionBloqueada toma pg_advisory_xact_lock con $queryRaw antes de la función", async () => {
      const db = crearDb();
      const orden: string[] = [];
      db.$queryRaw.mockImplementation(async () => {
        orden.push("lock");
        return [];
      });
      db.$transaction.mockImplementation(async (fn: (tx: DbFalso) => unknown) => {
        orden.push("transaccion");
        return fn(db);
      });

      await repo(db).enTransaccionBloqueada(async (tx) => {
        orden.push("callback");
        expect(tx).toBeDefined();
      });

      expect(orden).toEqual(["transaccion", "lock", "callback"]);
      const plantilla = db.$queryRaw.mock.calls[0][0] as TemplateStringsArray;
      expect(String(plantilla)).toContain("pg_advisory_xact_lock");
      expect(db.$queryRaw.mock.calls[0][1]).toBe(880000001);
    });

    it("la consulta del lock pide una columna soportada (Prisma no deserializa void)", async () => {
      const db = crearDb();

      await repo(db).enTransaccionBloqueada(async () => "ok");

      const sql = String(db.$queryRaw.mock.calls[0][0]).replace(/\s+/g, " ");
      // `SELECT pg_advisory_xact_lock(...)` devuelve una columna `void` y Prisma 6.19 falla al
      // deserializarla ("Failed to deserialize column of type 'void'").
      expect(sql).toContain("pg_advisory_xact_lock");
      expect(sql).toMatch(/SELECT 1 AS ok/i);
      expect(sql).not.toMatch(/^SELECT pg_advisory_xact_lock/i);
    });

    it("enTransaccionBloqueada pasa maxWait 1000 y timeout 2000", async () => {
      const db = crearDb();

      await repo(db).enTransaccionBloqueada(async () => "ok");

      expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 1000,
        timeout: 2000,
      });
    });

    it("enTransaccionBloqueada propaga el error", async () => {
      const db = crearDb();

      await expect(
        repo(db).enTransaccionBloqueada(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
    });
  });

});
