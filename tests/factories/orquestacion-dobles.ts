import { CONFIGURACION_POR_DEFECTO, type Configuracion } from "@/lib/configuracion";
import type {
  AsignacionPort,
  EntradaLeida,
  NuevaReserva,
} from "@/domains/asignacion/asignacion-puerto";
import type {
  SugerenciaVigenteLeida,
  UltimaAsignacionLeida,
} from "@/domains/asignacion/asignacion-puerto";
import type { ResultadoMotor } from "@/domains/asignacion/motor-espera";

export const AHORA = new Date("2026-10-25T10:00:00.000Z");
export const DIEZ_QUINCE = new Date("2026-10-25T10:15:00.000Z");
export const DIEZ_TREINTA = new Date("2026-10-25T10:30:00.000Z");

export const CONFIGURACION: Configuracion = CONFIGURACION_POR_DEFECTO;

export function exito(espera = 120, ahorro = 60): ResultadoMotor {
  return {
    tipo: "exito",
    recomendado: { ejercicioId: "E2", espera, maquinaId: "M2" },
    siguienteEnOrden: { ejercicioId: "E1", espera: espera + ahorro, maquinaId: "M1" },
    ahorro,
    bloqueados: [],
  };
}

export function entradaLeida(segundosEjecucionSerie = 60): EntradaLeida {
  return {
    entrada: {
      ejercicios: [{ id: "E2", orden: 1, series: 3, descanso: 60, candidatos: ["M2"] }],
      maquinas: [{ id: "M2", estado: "DISPONIBLE", ocupante: null, cola: [] }],
      parametros: { segundosEjecucionSerie },
    },
    rutina: {
      rutinaAsignadaId: "ra-1",
      ejercicios: [
        {
          ejercicioId: "E2",
          nombre: "Press banca",
          orden: 1,
          series: 3,
          descanso: 60,
          candidatos: ["M2"],
        },
      ],
    },
    configuracion: { ...CONFIGURACION, segundosEjecucionSerie },
    ejercicioActualId: null,
  };
}

export interface OpcionesPuerto {
  configuracion?: Partial<Configuracion>;
  tieneRutina?: boolean;
  /** `null` simula que la rutina se desactivó entre el gate y la lectura. */
  entrada?: EntradaLeida | null;
  errorTransaccion?: Error;
  nuncaResuelve?: boolean;
  sugerencia?: SugerenciaVigenteLeida | null;
  ultima?: UltimaAsignacionLeida | null;
  cancelarReservaResultado?: boolean;
  socioDeUsuario?: string | null;
  socioExiste?: boolean;
  /** Hace fallar la lectura de la entrada fuera de una transacción. */
  errorLectura?: boolean;
}

export interface PuertoFalso {
  repositorio: AsignacionPort;
  llamadas: string[];
  crearReserva: jest.Mock;
  cancelarReservasActivas: jest.Mock;
  cancelarReserva: jest.Mock;
  leerEntradaMotor: jest.Mock;
  leerConfiguracion: jest.Mock;
  leerSugerenciaVigente: jest.Mock;
  leerUltimaAsignacion: jest.Mock;
  enTransaccionBloqueada: jest.Mock;
  tieneRutinaActiva: jest.Mock;
  resolverSocioPorUsuario: jest.Mock;
  existeSocio: jest.Mock;
}

export function sugerencia(
  overrides: Partial<SugerenciaVigenteLeida> = {}
): SugerenciaVigenteLeida {
  return {
    id: "a-1",
    socioId: "socio-1",
    ejercicioId: "E2",
    ejercicioNombre: "Press banca",
    maquinaId: "M2",
    maquinaNombre: "Prensa",
    esperaSegundos: 120,
    ahorroSegundos: 60,
    creadaEn: new Date("2026-10-25T09:55:00.000Z"),
    venceEn: new Date("2026-10-25T10:15:00.000Z"),
    ...overrides,
  };
}

export function crearPuerto(opciones: OpcionesPuerto = {}): PuertoFalso {
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
    if (opciones.errorLectura) throw new Error("lectura rota");
    return "entrada" in opciones
      ? opciones.entrada
      : entradaLeida(opciones.configuracion?.segundosEjecucionSerie);
  });
  const leerConfiguracion = jest.fn(async () => ({ ...CONFIGURACION, ...opciones.configuracion }));
  const leerSugerenciaVigente = jest.fn(async () => opciones.sugerencia ?? null);
  const leerUltimaAsignacion = jest.fn(async () => opciones.ultima ?? null);
  const resolverSocioPorUsuario = jest.fn(async () => opciones.socioDeUsuario ?? null);
  const existeSocio = jest.fn(async () => opciones.socioExiste ?? true);
  const cancelarReserva = jest.fn(async () => {
    llamadas.push("cancelarReserva");
    return opciones.cancelarReservaResultado ?? true;
  });
  // El gate queda fuera de `llamadas` a propósito: el registro describe la transacción.
  const tieneRutinaActiva = jest.fn(async () => opciones.tieneRutina ?? true);

  const enTransaccionBloqueada = jest.fn(
    async <T>(fn: (tx: unknown) => Promise<T>, _opciones?: unknown) => {
      llamadas.push("enTransaccionBloqueada");
      void _opciones;
      if (opciones.nuncaResuelve) return new Promise<T>(() => {});
      if (opciones.errorTransaccion) throw opciones.errorTransaccion;
      return fn({
        leerConfiguracion,
        leerEntradaMotor,
        cancelarReservasActivas,
        crearReserva,
        leerSugerenciaVigente,
        leerUltimaAsignacion,
        cancelarReserva,
      });
    }
  );

  const repositorio = {
    tieneRutinaActiva,
    enTransaccionBloqueada,
    leerSugerenciaVigente,
    leerConfiguracion,
    leerEntradaMotor,
    resolverSocioPorUsuario,
    existeSocio,
  } as unknown as AsignacionPort;

  return {
    repositorio,
    llamadas,
    crearReserva,
    cancelarReservasActivas,
    cancelarReserva,
    leerEntradaMotor,
    leerConfiguracion,
    leerSugerenciaVigente,
    leerUltimaAsignacion,
    enTransaccionBloqueada,
    tieneRutinaActiva,
    resolverSocioPorUsuario,
    existeSocio,
  };
}
