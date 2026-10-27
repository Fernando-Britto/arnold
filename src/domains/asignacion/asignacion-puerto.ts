import type { Prisma } from "@prisma/client";
import type { Configuracion, ConfiguracionReader } from "@/lib/configuracion";
import type { EntradaMotor } from "./motor-espera";

export const CLAVE_LOCK_INSTALACION = 880_000_001;
export const MAX_WAIT_TRANSACCION_MS = 1_000;
export const TIMEOUT_TRANSACCION_MS = 2_000;

export type EstadoAsignacionPersistido = "RESERVADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";

export interface EjercicioDeRutinaLeido {
  ejercicioId: string;
  nombre: string;
  orden: number;
  series: number;
  descanso: number;
  candidatos: string[];
}

export interface RutinaActivaLeida {
  rutinaAsignadaId: string;
  /** Ordenados por `orden asc, id asc`. */
  ejercicios: EjercicioDeRutinaLeido[];
}

export interface EntradaLeida {
  entrada: EntradaMotor;
  rutina: RutinaActivaLeida;
  configuracion: Configuracion;
  /** Sesión EN_CURSO del socio, si existe. */
  ejercicioActualId: string | null;
}

export interface SugerenciaVigenteLeida {
  id: string;
  socioId: string;
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string;
  maquinaNombre: string | null;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: Date;
  venceEn: Date;
}

export interface UltimaAsignacionLeida {
  estado: EstadoAsignacionPersistido;
  creadaEn: Date;
}

export interface NuevaReserva {
  socioId: string;
  ejercicioId: string;
  maquinaId: string;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: Date;
  venceEn: Date;
}

export interface LecturaEntrada {
  socioId: string;
  ahora: Date;
  minutosInactividadSesion: number;
  excluirEjercicioIds: string[];
}

export interface AsignacionTx {
  leerEntradaMotor(lectura: LecturaEntrada): Promise<EntradaLeida | null>;
  leerSugerenciaVigente(socioId: string, ahora: Date): Promise<SugerenciaVigenteLeida | null>;
  leerUltimaAsignacion(socioId: string): Promise<UltimaAsignacionLeida | null>;
  leerConfiguracion(): Promise<Configuracion>;
  cancelarReservasActivas(socioId: string, ahora: Date): Promise<number>;
  crearReserva(datos: NuevaReserva): Promise<{ id: string }>;
  consumirReserva(id: string, sesionId: string, ahora: Date): Promise<boolean>;
  cancelarReserva(id: string, ahora: Date): Promise<boolean>;
  completarEjecucion(sesionId: string, ejercicioId: string): Promise<number>;
  completarEjecucionesDeSesion(sesionId: string): Promise<number>;
  crearEjecucionEnCurso(datos: {
    socioId: string;
    sesionId: string;
    ejercicioId: string;
    maquinaId: string | null;
    ahora: Date;
  }): Promise<{ id: string }>;
}

export interface AsignacionPort extends AsignacionTx {
  tieneRutinaActiva(socioId: string): Promise<boolean>;
  resolverSocioPorUsuario(usuarioId: string): Promise<string | null>;
  existeSocio(socioId: string): Promise<boolean>;
  enTransaccionBloqueada<T>(
    fn: (tx: AsignacionTx) => Promise<T>,
    opciones?: { maxWait?: number; timeout?: number }
  ): Promise<T>;
}

/** Lecturas que necesita el armado de la entrada, más cola y escrituras. */
export interface AsignacionLecturasBase {
  leerEntradaMotor(lectura: LecturaEntrada, db?: AsignacionDb): Promise<EntradaLeida | null>;
  leerSugerenciaVigente(
    socioId: string,
    ahora: Date,
    db?: AsignacionDb
  ): Promise<SugerenciaVigenteLeida | null>;
  leerUltimaAsignacion(socioId: string, db?: AsignacionDb): Promise<UltimaAsignacionLeida | null>;
  leerConfiguracion(db?: AsignacionDb): Promise<Configuracion>;
  tieneRutinaActiva(socioId: string, db?: AsignacionDb): Promise<boolean>;
  resolverSocioPorUsuario(usuarioId: string, db?: AsignacionDb): Promise<string | null>;
  existeSocio(socioId: string, db?: AsignacionDb): Promise<boolean>;
}

export interface AsignacionDb extends ConfiguracionReader {
  asignacionDeEjercicio: {
    findFirst(args: Prisma.AsignacionDeEjercicioFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.AsignacionDeEjercicioFindManyArgs): Promise<unknown[]>;
    updateMany(args: Prisma.AsignacionDeEjercicioUpdateManyArgs): Promise<{ count: number }>;
    create(args: Prisma.AsignacionDeEjercicioCreateArgs): Promise<{ id: string }>;
  };
  rutinaAsignada: {
    findFirst(args: Prisma.RutinaAsignadaFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.RutinaAsignadaFindManyArgs): Promise<unknown[]>;
  };
  sesionDeEntrenamiento: {
    findFirst(args: Prisma.SesionDeEntrenamientoFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.SesionDeEntrenamientoFindManyArgs): Promise<unknown[]>;
  };
  registroDeProgreso: { findMany(args: Prisma.RegistroDeProgresoFindManyArgs): Promise<unknown[]> };
  ejercicioMaquina: { findMany(args: Prisma.EjercicioMaquinaFindManyArgs): Promise<unknown[]> };
  maquina: { findMany(args: Prisma.MaquinaFindManyArgs): Promise<unknown[]> };
  socio: { findUnique(args: Prisma.SocioFindUniqueArgs): Promise<unknown> };
  $queryRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<unknown[]>;
  $transaction<R>(
    fn: (tx: AsignacionDb) => Promise<R>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<R>;
}


export type CargadorDb = () => Promise<AsignacionDb>;

export async function getPrisma(): Promise<AsignacionDb> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as AsignacionDb;
}

export const SERIES_DE_TRABAJO = ["NORMAL", "HASTA_EL_FALLO"] as const;

export function anomalia(tipo: string, datos: Record<string, unknown>): void {
  console.error("[ASIGNACION][anomalia]", { tipo, ...datos });
}
