import type { Configuracion } from "@/lib/configuracion";
import type {
  AsignacionDb,
  AsignacionPort,
  AsignacionTx,
  CargadorDb,
  EntradaLeida,
  LecturaEntrada,
  NuevaReserva,
  SugerenciaVigenteLeida,
  UltimaAsignacionLeida,
} from "./asignacion-puerto";
import {
  CLAVE_LOCK_INSTALACION,
  MAX_WAIT_TRANSACCION_MS,
  TIMEOUT_TRANSACCION_MS,
  getPrisma,
} from "./asignacion-puerto";
import { AsignacionLecturas } from "./asignacion-lecturas";
import { AsignacionEscrituras } from "./asignacion-escrituras";

export type * from "./asignacion-puerto";

/**
 * Composición mínima (design §6): lecturas + escrituras y la transacción que las une bajo el
 * advisory lock global. Toda la lógica vive en los módulos por responsabilidad.
 */
export class AsignacionRepository implements AsignacionPort {
  private readonly lecturas: AsignacionLecturas;
  private readonly escrituras: AsignacionEscrituras;

  constructor(private readonly cargar: CargadorDb = getPrisma) {
    this.lecturas = new AsignacionLecturas(cargar);
    this.escrituras = new AsignacionEscrituras(cargar);
  }

  leerEntradaMotor(lectura: LecturaEntrada, db?: AsignacionDb): Promise<EntradaLeida | null> {
    return this.lecturas.leerEntradaMotor(lectura, db);
  }

  leerSugerenciaVigente(
    socioId: string,
    ahora: Date,
    db?: AsignacionDb
  ): Promise<SugerenciaVigenteLeida | null> {
    return this.lecturas.leerSugerenciaVigente(socioId, ahora, db);
  }

  leerUltimaAsignacion(socioId: string, db?: AsignacionDb): Promise<UltimaAsignacionLeida | null> {
    return this.lecturas.leerUltimaAsignacion(socioId, db);
  }

  leerConfiguracion(db?: AsignacionDb): Promise<Configuracion> {
    return this.lecturas.leerConfiguracion(db);
  }

  tieneRutinaActiva(socioId: string, db?: AsignacionDb): Promise<boolean> {
    return this.lecturas.tieneRutinaActiva(socioId, db);
  }

  resolverSocioPorUsuario(usuarioId: string, db?: AsignacionDb): Promise<string | null> {
    return this.lecturas.resolverSocioPorUsuario(usuarioId, db);
  }

  existeSocio(socioId: string, db?: AsignacionDb): Promise<boolean> {
    return this.lecturas.existeSocio(socioId, db);
  }

  cancelarReservasActivas(socioId: string, ahora: Date, db?: AsignacionDb): Promise<number> {
    return this.escrituras.cancelarReservasActivas(socioId, ahora, db);
  }

  crearReserva(datos: NuevaReserva, db?: AsignacionDb): Promise<{ id: string }> {
    return this.escrituras.crearReserva(datos, db);
  }

  consumirReserva(id: string, sesionId: string, ahora: Date, db?: AsignacionDb): Promise<boolean> {
    return this.escrituras.consumirReserva(id, sesionId, ahora, db);
  }

  cancelarReserva(id: string, ahora: Date, db?: AsignacionDb): Promise<boolean> {
    return this.escrituras.cancelarReserva(id, ahora, db);
  }

  completarEjecucion(sesionId: string, ejercicioId: string, db?: AsignacionDb): Promise<number> {
    return this.escrituras.completarEjecucion(sesionId, ejercicioId, db);
  }

  completarEjecucionesDeSesion(sesionId: string, db?: AsignacionDb): Promise<number> {
    return this.escrituras.completarEjecucionesDeSesion(sesionId, db);
  }

  crearEjecucionEnCurso(
    datos: {
      socioId: string;
      sesionId: string;
      ejercicioId: string;
      maquinaId: string | null;
      ahora: Date;
    },
    db?: AsignacionDb
  ): Promise<{ id: string }> {
    return this.escrituras.crearEjecucionEnCurso(datos, db);
  }

  /** Transacción con advisory lock global: serializa lectura, cálculo y escritura (design §5). */
  async enTransaccionBloqueada<T>(
    fn: (tx: AsignacionTx) => Promise<T>,
    opciones: { maxWait?: number; timeout?: number } = {}
  ): Promise<T> {
    const db = await this.cargar();
    return db.$transaction(
      async (tx) => {
        // Prisma 6.19 no deserializa la columna `void` de la función: se envuelve para devolver un
        // entero. El lock sigue siendo pg_advisory_xact_lock dentro de esta misma transacción.
        await tx.$queryRaw`
          SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(${CLAVE_LOCK_INSTALACION}::bigint)) AS t
        `;
        const puerto: AsignacionTx = {
          leerEntradaMotor: (lectura) => this.lecturas.leerEntradaMotor(lectura, tx as AsignacionDb),
          leerSugerenciaVigente: (socioId, ahora) =>
            this.lecturas.leerSugerenciaVigente(socioId, ahora, tx as AsignacionDb),
          leerUltimaAsignacion: (socioId) =>
            this.lecturas.leerUltimaAsignacion(socioId, tx as AsignacionDb),
          leerConfiguracion: () => this.lecturas.leerConfiguracion(tx as AsignacionDb),
          cancelarReservasActivas: (socioId, ahora) =>
            this.escrituras.cancelarReservasActivas(socioId, ahora, tx as AsignacionDb),
          crearReserva: (datos) => this.escrituras.crearReserva(datos, tx as AsignacionDb),
          consumirReserva: (id, sesionId, ahora) =>
            this.escrituras.consumirReserva(id, sesionId, ahora, tx as AsignacionDb),
          cancelarReserva: (id, ahora) =>
            this.escrituras.cancelarReserva(id, ahora, tx as AsignacionDb),
          completarEjecucion: (sesionId, ejercicioId) =>
            this.escrituras.completarEjecucion(sesionId, ejercicioId, tx as AsignacionDb),
          completarEjecucionesDeSesion: (sesionId) =>
            this.escrituras.completarEjecucionesDeSesion(sesionId, tx as AsignacionDb),
          crearEjecucionEnCurso: (datos) =>
            this.escrituras.crearEjecucionEnCurso(datos, tx as AsignacionDb),
        };
        return fn(puerto);
      },
      {
        maxWait: opciones.maxWait ?? MAX_WAIT_TRANSACCION_MS,
        timeout: opciones.timeout ?? TIMEOUT_TRANSACCION_MS,
      }
    );
  }
}

export const asignacionRepository = new AsignacionRepository();
