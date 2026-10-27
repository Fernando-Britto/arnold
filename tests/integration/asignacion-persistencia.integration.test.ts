import { prisma } from "@/lib/db";
import { asignacionRepository } from "@/domains/asignacion/asignacion-repositorio";
import {
  AHORA,
  crearEscenario,
  crearSesionEnCurso,
  limpiar,
  lectura,
  minutos,
} from "./asignacion-fixtures";

describe("AsignacionRepository contra Postgres real", () => {
  beforeAll(async () => {
    const filas = await prisma.$queryRaw<{ db: string }[]>/*sql*/ `SELECT current_database() AS db`;
    if (filas[0]?.db !== "arnold_test") {
      throw new Error(
        `La suite de integración solo corre contra la base de prueba (arnold_test); conectada a: ${filas[0]?.db}`
      );
    }
  });

  beforeEach(limpiar);
  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  });

  it("persiste RESERVADA con snapshot y no cambia Maquina.estado", async () => {
    const escenario = await crearEscenario({ nombre: "Ana", maquinas: 1 });

    const creada = await asignacionRepository.crearReserva({
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      esperaSegundos: 120,
      ahorroSegundos: 60,
      creadaEn: AHORA,
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    });

    const fila = await prisma.asignacionDeEjercicio.findUniqueOrThrow({ where: { id: creada.id } });
    expect(fila.estado).toBe("RESERVADA");
    expect(fila.esperaSegundos).toBe(120);
    expect(fila.ahorroSegundos).toBe(60);
    expect(fila.creadaEn).toEqual(AHORA);

    const maquina = await prisma.maquina.findUniqueOrThrow({
      where: { id: escenario.maquinaIds[0] },
    });
    expect(maquina.estado).toBe("DISPONIBLE");
  });

  it("una sola reserva activa por socio tras cancelar y crear", async () => {
    const escenario = await crearEscenario({ nombre: "Beto", maquinas: 1 });
    const base = {
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: AHORA,
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    };

    const primera = await asignacionRepository.crearReserva(base);
    expect(await asignacionRepository.cancelarReservasActivas(escenario.socioId, AHORA)).toBe(1);
    await asignacionRepository.crearReserva({ ...base, esperaSegundos: 60 });

    const activas = await prisma.asignacionDeEjercicio.findMany({
      where: { socioId: escenario.socioId, estado: "RESERVADA" },
    });
    expect(activas).toHaveLength(1);
    expect(activas[0].esperaSegundos).toBe(60);

    const cancelada = await prisma.asignacionDeEjercicio.findUniqueOrThrow({
      where: { id: primera.id },
    });
    expect(cancelada.estado).toBe("CANCELADA");
  });

  it("consumirReserva fija sesionId y estado EN_CURSO", async () => {
    const escenario = await crearEscenario({ nombre: "Caro", maquinas: 1 });
    const sesionId = await crearSesionEnCurso(escenario, { horaInicio: minutos(5) });
    const reserva = await asignacionRepository.crearReserva({
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: AHORA,
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    });

    expect(await asignacionRepository.consumirReserva(reserva.id, sesionId, AHORA)).toBe(true);
    const fila = await prisma.asignacionDeEjercicio.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(fila.estado).toBe("EN_CURSO");
    expect(fila.sesionId).toBe(sesionId);
  });

  it("completarEjecucion no toca una fila ya COMPLETADA", async () => {
    const escenario = await crearEscenario({ nombre: "Dani", maquinas: 1 });
    const sesionId = await crearSesionEnCurso(escenario, { horaInicio: minutos(5) });
    const ejecucion = await asignacionRepository.crearEjecucionEnCurso({
      socioId: escenario.socioId,
      sesionId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      ahora: AHORA,
    });

    expect(await asignacionRepository.completarEjecucion(sesionId, escenario.ejercicioId)).toBe(1);
    expect(await asignacionRepository.completarEjecucion(sesionId, escenario.ejercicioId)).toBe(0);

    const fila = await prisma.asignacionDeEjercicio.findUniqueOrThrow({
      where: { id: ejecucion.id },
    });
    expect(fila.estado).toBe("COMPLETADA");
  });

  it("vencimiento perezoso: una reserva vencida no es sugerencia y sigue RESERVADA", async () => {
    const escenario = await crearEscenario({ nombre: "Eva", maquinas: 1 });
    const reserva = await asignacionRepository.crearReserva({
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: AHORA,
      venceEn: AHORA,
    });

    expect(await asignacionRepository.leerSugerenciaVigente(escenario.socioId, AHORA)).toBeNull();
    const fila = await prisma.asignacionDeEjercicio.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(fila.estado).toBe("RESERVADA");
  });

  it("P-67: la cola ajena aparece y la propia no", async () => {
    const a = await crearEscenario({ nombre: "Fede", maquinas: 1 });
    const b = await crearEscenario({ nombre: "Gabi", maquinas: 1 });

    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: a.ejercicioId, maquinaId: b.maquinaIds[0] },
    });
    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: b.ejercicioId, maquinaId: a.maquinaIds[0] },
    });

    await asignacionRepository.crearReserva({
      socioId: a.socioId,
      ejercicioId: a.ejercicioId,
      maquinaId: a.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: minutos(10),
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    });
    await asignacionRepository.crearReserva({
      socioId: b.socioId,
      ejercicioId: b.ejercicioId,
      maquinaId: a.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: minutos(5),
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    });

    const entradaDeA = await asignacionRepository.leerEntradaMotor(lectura(a.socioId));
    const maquinaDeA = entradaDeA?.entrada.maquinas.find((m) => m.id === a.maquinaIds[0]);
    expect(maquinaDeA?.cola).toHaveLength(1);
  });

  it("ocupante real: calentamiento y drop set no descuentan series", async () => {
    const ocupante = await crearEscenario({ nombre: "Hugo", maquinas: 1, series: 3 });
    const consultante = await crearEscenario({ nombre: "Ines", maquinas: 1 });
    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: consultante.ejercicioId, maquinaId: ocupante.maquinaIds[0] },
    });

    const sesionId = await crearSesionEnCurso(ocupante, { horaInicio: minutos(20) });
    await prisma.registroDeProgreso.createMany({
      data: [
        {
          socioId: ocupante.socioId,
          ejercicioId: ocupante.ejercicioId,
          sesionId,
          carga: 20,
          repeticiones: 10,
          numeroSerie: null,
          tipo: "CALENTAMIENTO",
          fecha: minutos(10),
        },
        {
          socioId: ocupante.socioId,
          ejercicioId: ocupante.ejercicioId,
          sesionId,
          carga: 40,
          repeticiones: 10,
          numeroSerie: 1,
          tipo: "NORMAL",
          fecha: minutos(8),
        },
        {
          socioId: ocupante.socioId,
          ejercicioId: ocupante.ejercicioId,
          sesionId,
          carga: 30,
          repeticiones: 8,
          numeroSerie: null,
          tipo: "DROP_SET",
          fecha: minutos(7),
        },
      ],
    });

    const entrada = await asignacionRepository.leerEntradaMotor(lectura(consultante.socioId));
    const maquina = entrada?.entrada.maquinas.find((m) => m.id === ocupante.maquinaIds[0]);
    expect(maquina?.ocupante).toEqual({ seriesRestantes: 2, descanso: 90 });
  });

  it("sesión EN_CURSO vieja no ocupa y la fresca sí", async () => {
    const vieja = await crearEscenario({ nombre: "Juan", maquinas: 1 });
    const fresca = await crearEscenario({ nombre: "Lola", maquinas: 1 });
    const consultante = await crearEscenario({ nombre: "Mora", maquinas: 1 });

    for (const escenario of [vieja, fresca]) {
      await prisma.ejercicioMaquina.create({
        data: { ejercicioId: consultante.ejercicioId, maquinaId: escenario.maquinaIds[0] },
      });
    }

    const sesionVieja = await crearSesionEnCurso(vieja, { horaInicio: minutos(120) });
    await crearSesionEnCurso(fresca, { horaInicio: minutos(10) });
    await prisma.registroDeProgreso.create({
      data: {
        socioId: vieja.socioId,
        ejercicioId: vieja.ejercicioId,
        sesionId: sesionVieja,
        carga: 20,
        repeticiones: 10,
        numeroSerie: 1,
        tipo: "NORMAL",
        fecha: minutos(31),
      },
    });

    const entrada = await asignacionRepository.leerEntradaMotor(lectura(consultante.socioId));
    const maquinaVieja = entrada?.entrada.maquinas.find((m) => m.id === vieja.maquinaIds[0]);
    const maquinaFresca = entrada?.entrada.maquinas.find((m) => m.id === fresca.maquinaIds[0]);

    expect(maquinaVieja?.ocupante).toBeNull();
    expect(maquinaFresca?.ocupante).toEqual({ seriesRestantes: 3, descanso: 90 });
  });

  it("borrar un ejercicio sin progreso ni rutina elimina sus asignaciones", async () => {
    const escenario = await crearEscenario({ nombre: "Nico", maquinas: 1 });
    // Se quita la rutina para que el ejercicio quede sin `EjercicioEnRutina` ni progreso.
    await prisma.rutinaAsignada.deleteMany({ where: { socioId: escenario.socioId } });
    await prisma.ejercicioEnRutina.deleteMany({ where: { ejercicioId: escenario.ejercicioId } });

    await asignacionRepository.crearReserva({
      socioId: escenario.socioId,
      ejercicioId: escenario.ejercicioId,
      maquinaId: escenario.maquinaIds[0],
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: AHORA,
      venceEn: new Date("2026-10-26T10:15:00.000Z"),
    });

    await prisma.ejercicio.delete({ where: { id: escenario.ejercicioId } });

    const asignaciones = await prisma.asignacionDeEjercicio.findMany({
      where: { ejercicioId: escenario.ejercicioId },
    });
    expect(asignaciones).toHaveLength(0);
  });

});
