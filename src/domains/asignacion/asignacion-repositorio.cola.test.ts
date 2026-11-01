import { AHORA, crearDb, lectura, repo } from "../../../tests/factories/asignacion-db";

describe("AsignacionRepository: ocupantes y cola", () => {
  describe("cola y vencimiento", () => {
    const minutos = (n: number) => new Date(AHORA.getTime() - n * 60_000);

    function preparar() {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue({
        id: "ra-1",
        rutina: {
          ejercicios: [
            { ejercicioId: "E1", series: 2, descanso: 90, orden: 1, ejercicio: { nombre: "Sentadilla" } },
          ],
        },
      });
      db.ejercicioMaquina.findMany.mockResolvedValue([{ ejercicioId: "E1", maquinaId: "M1" }]);
      db.maquina.findMany.mockResolvedValue([{ id: "M1", estado: "DISPONIBLE" }]);
      return db;
    }

    const filaReserva = (id: string, creadaEn: Date, socioId = "socio-2") => ({
      id,
      socioId,
      ejercicioId: "E1",
      maquinaId: "M1",
      creadaEn,
    });

    it("cola ordenada por creadaEn e id, con series y descanso de cada miembro", async () => {
      const db = preparar();
      db.asignacionDeEjercicio.findMany.mockImplementation(
        (args: { where: { estado?: string } }) =>
          Promise.resolve(
            args.where.estado === "RESERVADA"
              ? [
                  filaReserva("R1", minutos(60), "socio-2"),
                  filaReserva("R2", minutos(55), "socio-3"),
                  filaReserva("R3", minutos(55), "socio-4"),
                ]
              : []
          )
      );
      db.rutinaAsignada.findMany.mockResolvedValue([
        {
          socioId: "socio-2",
          rutina: { ejercicios: [{ ejercicioId: "E1", series: 3, descanso: 60 }] },
        },
        {
          socioId: "socio-3",
          rutina: { ejercicios: [{ ejercicioId: "E1", series: 1, descanso: 30 }] },
        },
        {
          socioId: "socio-4",
          rutina: { ejercicios: [{ ejercicioId: "E1", series: 2, descanso: 90 }] },
        },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].cola).toEqual([
        { series: 3, descanso: 60 },
        { series: 1, descanso: 30 },
        { series: 2, descanso: 90 },
      ]);
    });

    it("solo lee reservas no vencidas y de otros socios", async () => {
      const db = preparar();

      await repo(db).leerEntradaMotor(lectura);

      expect(db.asignacionDeEjercicio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: "RESERVADA",
            venceEn: { gt: AHORA },
            socioId: { not: "socio-1" },
            maquinaId: { in: ["M1"] },
          }),
          orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
        })
      );
    });

    it("una reserva no resoluble a rutina activa no aporta y loguea", async () => {
      const db = preparar();
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      db.asignacionDeEjercicio.findMany.mockImplementation(
        (args: { where: { estado?: string } }) =>
          Promise.resolve(
            args.where.estado === "RESERVADA" ? [filaReserva("R1", minutos(10))] : []
          )
      );
      db.rutinaAsignada.findMany.mockResolvedValue([]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].cola).toEqual([]);
      expect(error).toHaveBeenCalledWith(
        "[ASIGNACION][anomalia]",
        expect.objectContaining({ tipo: "reserva-sin-rutina" })
      );
      error.mockRestore();
    });

    it("P-67: las consultas de ocupantes y cola excluyen al socio actual", async () => {
      const db = preparar();

      await repo(db).leerEntradaMotor(lectura);

      expect(db.sesionDeEntrenamiento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ socioId: { not: "socio-1" } }),
        })
      );
      expect(db.asignacionDeEjercicio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: "EN_CURSO",
            socioId: { not: "socio-1" },
          }),
        })
      );
    });

    it("venceEn == ahora no es sugerencia vigente; 1 s antes sí", async () => {
      const db = crearDb();
      const fila = {
        id: "a-1",
        socioId: "socio-1",
        ejercicioId: "E1",
        maquinaId: "M1",
        esperaSegundos: 120,
        ahorroSegundos: 60,
        creadaEn: minutos(5),
        venceEn: new Date("2026-10-26T10:00:00.000Z"),
        ejercicio: { nombre: "Sentadilla" },
        maquina: { nombre: "Prensa" },
      };
      db.asignacionDeEjercicio.findMany.mockImplementation(
        (args: { where: { venceEn?: { gt: Date } } }) =>
          Promise.resolve(
            args.where.venceEn && fila.venceEn.getTime() > args.where.venceEn.gt.getTime()
              ? [fila]
              : []
          )
      );

      expect(
        await repo(db).leerSugerenciaVigente("socio-1", new Date("2026-10-26T10:00:00.000Z"))
      ).toBeNull();
      expect(
        await repo(db).leerSugerenciaVigente("socio-1", new Date("2026-10-26T09:59:59.000Z"))
      ).not.toBeNull();
    });
  });

});
