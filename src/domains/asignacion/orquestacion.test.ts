import type { Configuracion } from "@/lib/configuracion";
import type { AsignacionPort, EntradaLeida, NuevaReserva } from "./asignacion-puerto";
import type { ResultadoMotor } from "./motor-espera";
import { calcularYReservar, MARGEN_RESPUESTA_MS, TIMEOUT_CALCULO_MS } from "./orquestacion";

const AHORA = new Date("2026-10-25T10:00:00.000Z");
const DIEZ_QUINCE = new Date("2026-10-25T10:15:00.000Z");
const DIEZ_TREINTA = new Date("2026-10-25T10:30:00.000Z");

const CONFIGURACION: Configuracion = {
  capacidadMaxima: 0,
  periodoGracia: 0,
  diasInactividad: 15,
  descuentoReactivacion: 0,
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  segundosEjecucionSerie: 60,
  minutosVencimientoReserva: 15,
  minutosInactividadSesion: 30,
};

function exito(espera = 120, ahorro = 60): ResultadoMotor {
  return {
    tipo: "exito",
    recomendado: { ejercicioId: "E2", espera, maquinaId: "M2" },
    siguienteEnOrden: { ejercicioId: "E1", espera: espera + ahorro, maquinaId: "M1" },
    ahorro,
    bloqueados: [],
  };
}

function entradaLeida(): EntradaLeida {
  return {
    entrada: {
      ejercicios: [
        { id: "E1", orden: 1, series: 2, descanso: 90, candidatos: ["M1"] },
        { id: "E2", orden: 2, series: 3, descanso: 60, candidatos: ["M2"] },
      ],
      maquinas: [
        { id: "M1", estado: "DISPONIBLE", ocupante: null, cola: [] },
        { id: "M2", estado: "DISPONIBLE", ocupante: null, cola: [] },
      ],
      parametros: { segundosEjecucionSerie: 60 },
    },
    rutina: {
      rutinaAsignadaId: "ra-1",
      ejercicios: [
        { ejercicioId: "E1", nombre: "Sentadilla", orden: 1, series: 2, descanso: 90, candidatos: ["M1"] },
        { ejercicioId: "E2", nombre: "Press banca", orden: 2, series: 3, descanso: 60, candidatos: ["M2"] },
      ],
    },
    configuracion: CONFIGURACION,
    ejercicioActualId: null,
  };
}

interface PuertoFalso {
  repositorio: AsignacionPort;
  llamadas: string[];
  crearReserva: jest.Mock;
  cancelarReservasActivas: jest.Mock;
  leerEntradaMotor: jest.Mock;
  leerConfiguracion: jest.Mock;
  enTransaccionBloqueada: jest.Mock;
}

function crearPuerto(opciones: { configuracion?: Partial<Configuracion> } = {}): PuertoFalso {
  const llamadas: string[] = [];

  const cancelarReservasActivas = jest.fn(async () => {
    llamadas.push("cancelarReservasActivas");
    return 1;
  });
  const crearReserva = jest.fn(async (datos: NuevaReserva) => {
    llamadas.push("crearReserva");
    void datos;
    return { id: "a-1" };
  });
  const leerEntradaMotor = jest.fn(async () => {
    llamadas.push("leerEntradaMotor");
    return entradaLeida();
  });
  const leerConfiguracion = jest.fn(async () => ({
    ...CONFIGURACION,
    ...opciones.configuracion,
  }));

  const enTransaccionBloqueada = jest.fn(
    async <T>(fn: (tx: unknown) => Promise<T>, opcionesTx?: { maxWait?: number; timeout?: number }) => {
      llamadas.push("enTransaccionBloqueada");
      void opcionesTx;
      return fn({
        leerConfiguracion,
        leerEntradaMotor,
        cancelarReservasActivas,
        crearReserva,
      });
    }
  );

  const repositorio = {
    tieneRutinaActiva: jest.fn(async () => true),
    enTransaccionBloqueada,
  } as unknown as AsignacionPort;

  return {
    repositorio,
    llamadas,
    crearReserva,
    cancelarReservasActivas,
    leerEntradaMotor,
    leerConfiguracion,
    enTransaccionBloqueada,
  };
}

describe("calcularYReservar", () => {
  it("calcula y persiste la instantánea exacta del motor", async () => {
    const puerto = crearPuerto();

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.crearReserva).toHaveBeenCalledWith({
      socioId: "socio-1",
      ejercicioId: "E2",
      maquinaId: "M2",
      esperaSegundos: 120,
      ahorroSegundos: 60,
      creadaEn: AHORA,
      venceEn: DIEZ_QUINCE,
    });
    expect(resultado).toEqual({
      tipo: "reservada",
      asignacionId: "a-1",
      ejercicioId: "E2",
      maquinaId: "M2",
      esperaSegundos: 120,
      ahorroSegundos: 60,
      venceEn: DIEZ_QUINCE,
    });
  });

  it("cancela la reserva anterior antes de crear la nueva en la misma transacción", async () => {
    const puerto = crearPuerto();

    await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "INICIO_RUTINA" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.llamadas).toEqual([
      "enTransaccionBloqueada",
      "leerEntradaMotor",
      "cancelarReservasActivas",
      "crearReserva",
    ]);
    expect(puerto.enTransaccionBloqueada).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1000,
      timeout: TIMEOUT_CALCULO_MS,
    });
    expect(TIMEOUT_CALCULO_MS).toBe(2000);
    expect(MARGEN_RESPUESTA_MS).toBe(250);
  });

  it("usa el ahora inyectado para creadaEn y venceEn", async () => {
    const puerto = crearPuerto({ configuracion: { minutosVencimientoReserva: 30 } });

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "POST_EJERCICIO" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.crearReserva).toHaveBeenCalledWith(
      expect.objectContaining({ creadaEn: AHORA, venceEn: DIEZ_TREINTA })
    );
    expect(resultado).toEqual(expect.objectContaining({ venceEn: DIEZ_TREINTA }));
  });

  it("pasa ahora y minutosInactividadSesion al plan de lectura", async () => {
    const puerto = crearPuerto({ configuracion: { minutosInactividadSesion: 45 } });

    await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN", excluirEjercicioIds: ["E3"] },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.leerEntradaMotor).toHaveBeenCalledWith({
      socioId: "socio-1",
      ahora: AHORA,
      minutosInactividadSesion: 45,
      excluirEjercicioIds: ["E3"],
    });
  });

  it("con la configuración por defecto vence a los 15 minutos y usa ventana de 30", async () => {
    const puerto = crearPuerto();

    const resultado = await calcularYReservar(
      { socioId: "socio-1", ahora: AHORA, momento: "CHECK_IN" },
      { repositorio: puerto.repositorio, motor: () => exito() }
    );

    expect(puerto.leerEntradaMotor).toHaveBeenCalledWith(
      expect.objectContaining({ minutosInactividadSesion: 30 })
    );
    expect(resultado).toEqual(expect.objectContaining({ venceEn: DIEZ_QUINCE }));
  });
});
