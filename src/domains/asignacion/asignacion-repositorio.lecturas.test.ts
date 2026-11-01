import type { DbFalso } from "../../../tests/factories/asignacion-db";
import {
  AHORA,
  crearDb,
  lectura,
  repo,
  rutinaActiva,
  rutinaConE1DeTresSeries,
  rutinaConE1DeUnaSerie,
} from "../../../tests/factories/asignacion-db";

describe("AsignacionRepository: lecturas y guarda", () => {
  describe("lecturas base", () => {
    it("sin rutina activa devuelve null y no consulta candidatos", async () => {
      const db = crearDb();

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado).toBeNull();
      expect(db.ejercicioMaquina.findMany).not.toHaveBeenCalled();
    });

    it("lee la rutina activa ordenada por orden e id", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(db.rutinaAsignada.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { socioId: "socio-1", activa: true },
          orderBy: [{ fechaAsignacion: "desc" }, { id: "desc" }],
        })
      );
      expect(resultado?.rutina.ejercicios).toEqual([
        { ejercicioId: "E1", nombre: "Sentadilla", orden: 1, series: 2, descanso: 90, candidatos: [] },
        { ejercicioId: "E2", nombre: "Press banca", orden: 2, series: 1, descanso: 60, candidatos: [] },
      ]);
    });

    it("mapea candidatos por ejercicio en orden estable", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);
      db.ejercicioMaquina.findMany.mockResolvedValue([
        { ejercicioId: "E2", maquinaId: "M1" },
        { ejercicioId: "E1", maquinaId: "M2" },
        { ejercicioId: "E1", maquinaId: "M1" },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(db.ejercicioMaquina.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ejercicioId: { in: ["E1", "E2"] } },
          orderBy: [{ ejercicioId: "asc" }, { maquinaId: "asc" }],
        })
      );
      expect(resultado?.rutina.ejercicios[0].candidatos).toEqual(["M1", "M2"]);
      expect(resultado?.rutina.ejercicios[1].candidatos).toEqual(["M1"]);
    });

    it("sin sesión en curso todos los ejercicios están pendientes", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.ejercicios.map((e) => e.id)).toEqual(["E1", "E2"]);
      expect(resultado?.ejercicioActualId).toBeNull();
    });

    it("con sesión en curso descuenta solo series de trabajo dentro de la prescripción", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaConE1DeUnaSerie);
      db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s-1", ejercicioActualId: null });
      db.registroDeProgreso.findMany.mockResolvedValue([
        { ejercicioId: "E1", numeroSerie: null, tipo: "CALENTAMIENTO" },
        { ejercicioId: "E1", numeroSerie: null, tipo: "DROP_SET" },
        { ejercicioId: "E1", numeroSerie: 1, tipo: "NORMAL" },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.ejercicios.map((e) => e.id)).toEqual(["E2"]);
    });

    it("excluye el ejercicio actual y los excluidos explícitos", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);
      db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s-1", ejercicioActualId: "E1" });

      const resultado = await repo(db).leerEntradaMotor({
        ...lectura,
        excluirEjercicioIds: ["E2"],
      });

      expect(resultado?.entrada.ejercicios).toEqual([]);
      expect(resultado?.ejercicioActualId).toBe("E1");
    });

    it("una serie fuera de 1..prescripcion.series no descuenta", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaConE1DeTresSeries);
      db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s-1", ejercicioActualId: null });
      // Prescripción 3: solo cuentan 1 y 2; la 4 queda fuera de rango y no completa el ejercicio.
      db.registroDeProgreso.findMany.mockResolvedValue([
        { ejercicioId: "E1", numeroSerie: 1, tipo: "NORMAL" },
        { ejercicioId: "E1", numeroSerie: 2, tipo: "NORMAL" },
        { ejercicioId: "E1", numeroSerie: 4, tipo: "NORMAL" },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.ejercicios.map((e) => e.id)).toEqual(["E1"]);
    });

    it("los registros sin numeroSerie no cuentan", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);
      db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s-1", ejercicioActualId: null });
      db.registroDeProgreso.findMany.mockResolvedValue([
        { ejercicioId: "E1", numeroSerie: null, tipo: "NORMAL" },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.ejercicios.map((e) => e.id)).toEqual(["E1", "E2"]);
    });

    it("incluye solo máquinas candidatas existentes en el catálogo", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);
      db.ejercicioMaquina.findMany.mockResolvedValue([
        { ejercicioId: "E1", maquinaId: "M1" },
        { ejercicioId: "E1", maquinaId: "M2" },
        { ejercicioId: "E2", maquinaId: "M9" },
      ]);
      db.maquina.findMany.mockResolvedValue([
        { id: "M1", estado: "DISPONIBLE" },
        { id: "M2", estado: "OCUPADA" },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas).toEqual([
        { id: "M1", estado: "DISPONIBLE", ocupante: null, cola: [] },
        { id: "M2", estado: "OCUPADA", ocupante: null, cola: [] },
      ]);
    });

    it("usa segundosEjecucionSerie de la configuración, no un literal", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);
      db.configuracionDelSistema.findFirst.mockResolvedValue({ segundosEjecucionSerie: 90 });

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.parametros.segundosEjecucionSerie).toBe(90);
    });

    it("lee la sugerencia vigente más reciente y descarta vencidas", async () => {
      const db = crearDb();
      db.asignacionDeEjercicio.findMany.mockResolvedValue([
        {
          id: "a-2",
          socioId: "socio-1",
          ejercicioId: "E1",
          maquinaId: "M1",
          esperaSegundos: 120,
          ahorroSegundos: 60,
          creadaEn: new Date("2026-10-26T09:50:00.000Z"),
          venceEn: new Date("2026-10-26T10:15:00.000Z"),
          ejercicio: { nombre: "Sentadilla" },
          maquina: { nombre: "Prensa" },
        },
      ]);

      const resultado = await repo(db).leerSugerenciaVigente("socio-1", AHORA);

      expect(db.asignacionDeEjercicio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            socioId: "socio-1",
            estado: "RESERVADA",
            venceEn: { gt: AHORA },
            maquinaId: { not: null },
          }),
          orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
          take: 2,
        })
      );
      expect(resultado).toEqual(
        expect.objectContaining({
          id: "a-2",
          ejercicioNombre: "Sentadilla",
          maquinaNombre: "Prensa",
          esperaSegundos: 120,
          ahorroSegundos: 60,
        })
      );
    });

    it("si hay dos sugerencias vigentes devuelve la primera y loguea la anomalía", async () => {
      const db = crearDb();
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      const fila = {
        socioId: "socio-1",
        ejercicioId: "E1",
        maquinaId: "M1",
        esperaSegundos: 0,
        ahorroSegundos: 0,
        creadaEn: AHORA,
        venceEn: AHORA,
        ejercicio: { nombre: "Sentadilla" },
        maquina: { nombre: "Prensa" },
      };
      db.asignacionDeEjercicio.findMany.mockResolvedValue([
        { ...fila, id: "a-2" },
        { ...fila, id: "a-1" },
      ]);

      const resultado = await repo(db).leerSugerenciaVigente("socio-1", AHORA);

      expect(resultado?.id).toBe("a-2");
      expect(error).toHaveBeenCalledWith(
        "[ASIGNACION][anomalia]",
        expect.objectContaining({ tipo: "sugerencias-multiples" })
      );
      error.mockRestore();
    });

    it("sin sugerencia vigente devuelve null", async () => {
      const db = crearDb();

      expect(await repo(db).leerSugerenciaVigente("socio-1", AHORA)).toBeNull();
    });

    it("lee la última asignación por creadaEn desc", async () => {
      const db = crearDb();
      db.asignacionDeEjercicio.findFirst.mockResolvedValue({
        estado: "CANCELADA",
        creadaEn: new Date("2026-10-26T09:00:00.000Z"),
      });

      const resultado = await repo(db).leerUltimaAsignacion("socio-1");

      expect(db.asignacionDeEjercicio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { socioId: "socio-1" },
          orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
        })
      );
      expect(resultado?.estado).toBe("CANCELADA");
    });

    it("las lecturas son repetibles con el mismo ahora", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaActiva);

      const primera = await repo(db).leerEntradaMotor(lectura);
      const segunda = await repo(db).leerEntradaMotor(lectura);

      expect(primera).toEqual(segunda);
    });
  });

  describe("guarda de capacidad y puente usuario-socio", () => {
    it("tieneRutinaActiva devuelve false sin capability y no abre transacción", async () => {
      const db = crearDb();
      const sinModelo = { ...db, asignacionDeEjercicio: undefined } as unknown as DbFalso;

      const resultado = await repo(sinModelo).tieneRutinaActiva("socio-1");

      expect(resultado).toBe(false);
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.rutinaAsignada.findFirst).not.toHaveBeenCalled();
    });

    it("tieneRutinaActiva consulta la rutina activa con capability", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue({ id: "ra-1" });

      expect(await repo(db).tieneRutinaActiva("socio-1")).toBe(true);
      expect(db.rutinaAsignada.findFirst).toHaveBeenCalledWith({
        where: { socioId: "socio-1", activa: true },
        select: { id: true },
      });
    });

    it("resolverSocioPorUsuario devuelve el socio del usuario o null", async () => {
      const db = crearDb();
      db.socio.findUnique.mockResolvedValue({ id: "socio-1" });

      expect(await repo(db).resolverSocioPorUsuario("usuario-1")).toBe("socio-1");
      expect(db.socio.findUnique).toHaveBeenCalledWith({
        where: { usuarioId: "usuario-1" },
        select: { id: true },
      });

      db.socio.findUnique.mockResolvedValue(null);
      expect(await repo(db).resolverSocioPorUsuario("usuario-2")).toBeNull();
    });

    it("existeSocio distingue existente de inexistente", async () => {
      const db = crearDb();
      db.socio.findUnique.mockResolvedValue({ id: "socio-1" });
      expect(await repo(db).existeSocio("socio-1")).toBe(true);

      db.socio.findUnique.mockResolvedValue(null);
      expect(await repo(db).existeSocio("socio-9")).toBe(false);
    });
  });
});
