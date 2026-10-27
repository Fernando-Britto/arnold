import type { DbFalso } from "../../../tests/factories/asignacion-db";
import { AHORA, crearDb, lectura, repo } from "../../../tests/factories/asignacion-db";

describe("AsignacionRepository: ocupantes y cola", () => {
  describe("ocupantes", () => {
    const minutos = (n: number) => new Date(AHORA.getTime() - n * 60_000);

    const rutinaE1 = (series: number) => ({
      id: "ra-1",
      rutina: {
        ejercicios: [
          { ejercicioId: "E1", series, descanso: 90, orden: 1, ejercicio: { nombre: "Sentadilla" } },
        ],
      },
    });

    function preparar(series: number, candidatos: string[], estados: Record<string, string>) {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaE1(series));
      db.ejercicioMaquina.findMany.mockResolvedValue(
        candidatos.map((maquinaId) => ({ ejercicioId: "E1", maquinaId }))
      );
      db.maquina.findMany.mockResolvedValue(
        Object.entries(estados).map(([id, estado]) => ({ id, estado }))
      );
      return db;
    }

    /** Registros de progreso discriminados por consulta: la de actividad no filtra `tipo`. */
    function progreso(
      db: DbFalso,
      series: Array<{ sesionId: string; ejercicioId: string; numeroSerie: number }>,
      actividad: Array<{ sesionId: string; fecha: Date }>
    ) {
      db.registroDeProgreso.findMany.mockImplementation((args: { where: { tipo?: unknown } }) =>
        Promise.resolve(args.where.tipo ? series : actividad)
      );
    }

    function sesionOcupante(overrides: Record<string, unknown> = {}) {
      return {
        id: "s-otro",
        socioId: "socio-2",
        ejercicioActualId: "E1",
        horaInicio: minutos(10),
        rutinaAsignada: {
          rutina: { ejercicios: [{ ejercicioId: "E1", series: 3, descanso: 90 }] },
        },
        ...overrides,
      };
    }

    it("una candidata única sin fila deriva ocupante", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesionOcupante()]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(5) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante).toEqual({ seriesRestantes: 2, descanso: 90 });
    });

    it("varias candidatas sin fila no aportan ocupante", async () => {
      const db = preparar(3, ["M1", "M2"], { M1: "DISPONIBLE", M2: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesionOcupante()]);
      progreso(db, [], [{ sesionId: "s-otro", fecha: minutos(5) }]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas.every((m) => m.ocupante === null)).toBe(true);
    });

    it("una fila EN_CURSO con la máquina y ejercicio actuales fija el ocupante", async () => {
      const db = preparar(3, ["M1", "M2"], { M1: "DISPONIBLE", M2: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesionOcupante()]);
      db.asignacionDeEjercicio.findMany.mockImplementation((args: { where: { estado?: string } }) =>
        Promise.resolve(
          args.where.estado === "EN_CURSO"
            ? [
                {
                  id: "a-9",
                  socioId: "socio-2",
                  sesionId: "s-otro",
                  ejercicioId: "E1",
                  maquinaId: "M2",
                  creadaEn: minutos(6),
                },
              ]
            : []
        )
      );
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(5) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      const m2 = resultado?.entrada.maquinas.find((m) => m.id === "M2");
      expect(m2?.ocupante).toEqual({ seriesRestantes: 2, descanso: 90 });
    });

    it("seriesRestantes ignora CALENTAMIENTO y DROP_SET", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesionOcupante()]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(5) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante?.seriesRestantes).toBe(2);
    });

    it("ocupante con 0 restantes no ocupa", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([sesionOcupante()]);
      progreso(
        db,
        [1, 2, 3].map((n) => ({ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: n })),
        [{ sesionId: "s-otro", fecha: minutos(5) }]
      );

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante).toBeNull();
    });

    it("el descanso del ocupante sale de su EjercicioEnRutina", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({
          rutinaAsignada: {
            rutina: { ejercicios: [{ ejercicioId: "E1", series: 3, descanso: 120 }] },
          },
        }),
      ]);
      progreso(db, [], [{ sesionId: "s-otro", fecha: minutos(5) }]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante?.descanso).toBe(120);
    });

    it("sesión con actividad de 31 min no ocupa con ventana 30", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ horaInicio: minutos(60) }),
      ]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(31) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante).toBeNull();
    });

    it("sesión con actividad de 29 min ocupa con ventana 30", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ horaInicio: minutos(60) }),
      ]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(29) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante?.seriesRestantes).toBe(2);
    });

    it("sin registros usa horaInicio: fresca ocupa y vieja no", async () => {
      const fresco = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      fresco.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ horaInicio: minutos(10) }),
      ]);
      progreso(fresco, [], []);
      expect((await repo(fresco).leerEntradaMotor(lectura))?.entrada.maquinas[0].ocupante).not.toBeNull();

      const viejo = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      viejo.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ horaInicio: minutos(31) }),
      ]);
      progreso(viejo, [], []);
      expect((await repo(viejo).leerEntradaMotor(lectura))?.entrada.maquinas[0].ocupante).toBeNull();
    });

    it("la sesión vieja no aporta si hay una fresca", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ id: "s-vieja", socioId: "socio-3", horaInicio: minutos(90) }),
        sesionOcupante({ id: "s-fresca", socioId: "socio-4", horaInicio: minutos(5) }),
      ]);
      progreso(
        db,
        [{ sesionId: "s-fresca", ejercicioId: "E1", numeroSerie: 1 }],
        [
          { sesionId: "s-vieja", fecha: minutos(31) },
          { sesionId: "s-fresca", fecha: minutos(2) },
        ]
      );

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante?.seriesRestantes).toBe(2);
    });

    it("deriva el ocupante cuando su ejercicio no está entre los pendientes del consultante", async () => {
      const db = crearDb();
      db.rutinaAsignada.findFirst.mockResolvedValue(rutinaE1(2));
      db.ejercicioMaquina.findMany.mockImplementation(
        (args: { where: { ejercicioId: { in: string[] } } }) =>
          Promise.resolve(
            args.where.ejercicioId.in.includes("E2")
              ? [{ ejercicioId: "E2", maquinaId: "M1" }]
              : [{ ejercicioId: "E1", maquinaId: "M1" }]
          )
      );
      db.maquina.findMany.mockResolvedValue([{ id: "M1", estado: "DISPONIBLE" }]);
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({
          ejercicioActualId: "E2",
          rutinaAsignada: {
            rutina: { ejercicios: [{ ejercicioId: "E2", series: 3, descanso: 90 }] },
          },
        }),
      ]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E2", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(5) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante).toEqual({ seriesRestantes: 2, descanso: 90 });
    });

    it("actividad exactamente en el corte cuenta", async () => {
      const db = preparar(3, ["M1"], { M1: "DISPONIBLE" });
      db.sesionDeEntrenamiento.findMany.mockResolvedValue([
        sesionOcupante({ horaInicio: minutos(90) }),
      ]);
      progreso(db, [{ sesionId: "s-otro", ejercicioId: "E1", numeroSerie: 1 }], [
        { sesionId: "s-otro", fecha: minutos(30) },
      ]);

      const resultado = await repo(db).leerEntradaMotor(lectura);

      expect(resultado?.entrada.maquinas[0].ocupante?.seriesRestantes).toBe(2);
    });
  });

});
