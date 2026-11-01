import type {
  AsignacionPort,
  AsignacionTx,
  SugerenciaVigenteLeida,
} from "./asignacion-puerto";
import type { TimeoutsAsignacion } from "@/lib/asignacion-timeouts";
import {
  MAX_WAIT_POR_DEFECTO,
  TIMEOUT_CALCULO_POR_DEFECTO,
} from "@/lib/asignacion-timeouts";
import { asignacionRepository } from "./asignacion-repositorio";
import { calcularEspera } from "./motor-espera";

export const TIMEOUT_CALCULO_MS = TIMEOUT_CALCULO_POR_DEFECTO;
export const MARGEN_RESPUESTA_MS = 250;

/** Valores por defecto: los mismos de siempre, para que los llamantes no cambien. */
const TIMEOUTS_POR_DEFECTO: TimeoutsAsignacion = {
  calculoMs: TIMEOUT_CALCULO_POR_DEFECTO,
  maxWaitMs: MAX_WAIT_POR_DEFECTO,
};

export type MomentoCalculo = "CHECK_IN" | "INICIO_RUTINA" | "POST_EJERCICIO";

export interface CalcularYReservarInput {
  socioId: string;
  ahora: Date;
  momento: MomentoCalculo;
  excluirEjercicioIds?: string[];
}

export type ResultadoOrquestacion =
  | {
      tipo: "reservada";
      asignacionId: string;
      ejercicioId: string;
      maquinaId: string;
      esperaSegundos: number;
      ahorroSegundos: number;
      venceEn: Date;
    }
  | { tipo: "fallback"; motivo: "SIN_RUTINA" | "SIN_OPCIONES" | "VACIO" | "SIN_MAQUINA" }
  | { tipo: "contenido"; motivo: "INVALIDO" | "ERROR" | "TIMEOUT" };

export type ResultadoDecision =
  | { tipo: "aceptada"; reserva: SugerenciaVigenteLeida }
  | { tipo: "esperada" }
  | { tipo: "sin_sugerencia"; motivo: "NUNCA_EXISTIO" | "YA_NO_VIGENTE" }
  | { tipo: "contenido"; motivo: "ERROR" | "TIMEOUT" };

export interface DecidirSugerenciaInput {
  socioId: string;
  accion: "ACEPTAR" | "ESPERAR";
  ahora: Date;
}

export interface DepsOrquestacion {
  repositorio: AsignacionPort;
  motor: typeof calcularEspera;
  /** Configurables por entorno (D-110). Por defecto, los valores históricos. */
  timeouts: TimeoutsAsignacion;
}

const TIMEOUT = Symbol("timeout");

function resolverDeps(deps: Partial<DepsOrquestacion>): DepsOrquestacion {
  return {
    repositorio: deps.repositorio ?? asignacionRepository,
    motor: deps.motor ?? calcularEspera,
    timeouts: deps.timeouts ?? TIMEOUTS_POR_DEFECTO,
  };
}

function minutosEnMs(minutos: number): number {
  return minutos * 60_000;
}

function logError(tipo: string, datos: Record<string, unknown>): void {
  console.error("[ASIGNACION][orquestacion]", { tipo, ...datos });
}

/** Carrera externa: red de seguridad por encima del timeout de la transacción (D-98). */
async function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promesa,
      new Promise<typeof TIMEOUT>((resolve) => {
        temporizador = setTimeout(() => resolve(TIMEOUT), ms);
      }),
    ]);
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
}

/**
 * Calcula la sugerencia y persiste la reserva dentro de una transacción con el advisory lock global.
 * El `ahora` y el motor son inyectables: la orquestación no lee el reloj y nunca lanza.
 */
export async function calcularYReservar(
  input: CalcularYReservarInput,
  deps: Partial<DepsOrquestacion> = {}
): Promise<ResultadoOrquestacion> {
  const { repositorio, motor, timeouts } = resolverDeps(deps);

  try {
    return await calcularSeguro(input, repositorio, motor, timeouts);
  } catch (error) {
    logError("error", { socioId: input.socioId, momento: input.momento, error });
    return { tipo: "contenido", motivo: "ERROR" };
  }
}

async function calcularSeguro(
  input: CalcularYReservarInput,
  repositorio: AsignacionPort,
  motor: typeof calcularEspera,
  timeouts: TimeoutsAsignacion
): Promise<ResultadoOrquestacion> {
  if (!(await repositorio.tieneRutinaActiva(input.socioId))) {
    return { tipo: "fallback", motivo: "SIN_RUTINA" };
  }

  const trabajo = repositorio.enTransaccionBloqueada(
    async (tx): Promise<ResultadoOrquestacion> => {
      const configuracion = await tx.leerConfiguracion();
      const leida = await tx.leerEntradaMotor({
        socioId: input.socioId,
        ahora: input.ahora,
        minutosInactividadSesion: configuracion.minutosInactividadSesion,
        excluirEjercicioIds: input.excluirEjercicioIds ?? [],
      });
      if (!leida) return { tipo: "fallback", motivo: "SIN_RUTINA" };

      const resultado = motor(leida.entrada);

      if (resultado.tipo === "invalido") {
        logError("invalido", {
          socioId: input.socioId,
          momento: input.momento,
          errores: resultado.errores,
        });
        return { tipo: "contenido", motivo: "INVALIDO" };
      }

      if (resultado.tipo === "vacio" || resultado.tipo === "sin_opciones") {
        await tx.cancelarReservasActivas(input.socioId, input.ahora);
        return {
          tipo: "fallback",
          motivo: resultado.tipo === "vacio" ? "VACIO" : "SIN_OPCIONES",
        };
      }

      const maquinaId = resultado.recomendado.maquinaId;
      if (maquinaId === null) {
        await tx.cancelarReservasActivas(input.socioId, input.ahora);
        return { tipo: "fallback", motivo: "SIN_MAQUINA" };
      }

      const pertenece = leida.rutina.ejercicios.some(
        (ejercicio) =>
          ejercicio.ejercicioId === resultado.recomendado.ejercicioId &&
          ejercicio.candidatos.includes(maquinaId)
      );
      if (!pertenece) {
        logError("invalido", {
          socioId: input.socioId,
          momento: input.momento,
          motivo: "recomendacion-fuera-de-rutina",
        });
        return { tipo: "contenido", motivo: "INVALIDO" };
      }

      const venceEn = new Date(
        input.ahora.getTime() + minutosEnMs(configuracion.minutosVencimientoReserva)
      );

      await tx.cancelarReservasActivas(input.socioId, input.ahora);
      const reserva = await tx.crearReserva({
        socioId: input.socioId,
        ejercicioId: resultado.recomendado.ejercicioId,
        maquinaId,
        esperaSegundos: resultado.recomendado.espera,
        ahorroSegundos: resultado.ahorro,
        creadaEn: input.ahora,
        venceEn,
      });

      return {
        tipo: "reservada",
        asignacionId: reserva.id,
        ejercicioId: resultado.recomendado.ejercicioId,
        maquinaId,
        esperaSegundos: resultado.recomendado.espera,
        ahorroSegundos: resultado.ahorro,
        venceEn,
      };
    },
    { maxWait: timeouts.maxWaitMs, timeout: timeouts.calculoMs }
  );

  const salida = await conTimeout(trabajo, timeouts.calculoMs + MARGEN_RESPUESTA_MS);
  if (salida === TIMEOUT) {
    logError("timeout", {
      socioId: input.socioId,
      momento: input.momento,
      timeoutMs: timeouts.calculoMs + MARGEN_RESPUESTA_MS,
    });
    return { tipo: "contenido", motivo: "TIMEOUT" };
  }
  return salida;
}

/** Sugerencia vigente del socio (lectura de API y de sesión). */
export async function reservaVigente(
  input: { socioId: string; ahora: Date },
  deps: Partial<DepsOrquestacion> = {}
): Promise<SugerenciaVigenteLeida | null> {
  const { repositorio } = resolverDeps(deps);
  return repositorio.leerSugerenciaVigente(input.socioId, input.ahora);
}

/** Regla 404 vs 409 (D-102): sin vigente, decide el historial del socio. */
async function sinSugerencia(
  tx: AsignacionTx,
  input: { socioId: string; ahora: Date },
  minutosVentana: number
): Promise<ResultadoDecision> {
  const ultima = await tx.leerUltimaAsignacion(input.socioId);
  if (!ultima) return { tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" };
  if (ultima.estado === "RESERVADA") return { tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" };

  const desde = input.ahora.getTime() - minutosEnMs(minutosVentana);
  if (ultima.estado === "CANCELADA" && ultima.creadaEn.getTime() >= desde) {
    return { tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" };
  }
  return { tipo: "sin_sugerencia", motivo: "NUNCA_EXISTIO" };
}

/**
 * Aplica la decisión obligatoria bajo el mismo lock que el cálculo. ACEPTAR no escribe;
 * ESPERAR usa el `cancelarReserva` guardado, así que una reserva que venció entre la lectura
 * y la escritura no se cancela por error. Nunca lanza.
 */
export async function decidirSugerencia(
  input: DecidirSugerenciaInput,
  deps: Partial<DepsOrquestacion> = {}
): Promise<ResultadoDecision> {
  const { repositorio, timeouts } = resolverDeps(deps);

  try {
    const trabajo = repositorio.enTransaccionBloqueada(
      async (tx): Promise<ResultadoDecision> => {
        const vigente = await tx.leerSugerenciaVigente(input.socioId, input.ahora);
        if (!vigente) {
          const configuracion = await tx.leerConfiguracion();
          return sinSugerencia(tx, input, configuracion.minutosVencimientoReserva);
        }
        if (input.accion === "ACEPTAR") return { tipo: "aceptada", reserva: vigente };

        const cancelada = await tx.cancelarReserva(vigente.id, input.ahora);
        return cancelada
          ? { tipo: "esperada" }
          : { tipo: "sin_sugerencia", motivo: "YA_NO_VIGENTE" };
      },
      { maxWait: timeouts.maxWaitMs, timeout: timeouts.calculoMs }
    );

    const salida = await conTimeout(trabajo, timeouts.calculoMs + MARGEN_RESPUESTA_MS);
    if (salida === TIMEOUT) {
      logError("timeout", {
        socioId: input.socioId,
        accion: input.accion,
        timeoutMs: timeouts.calculoMs + MARGEN_RESPUESTA_MS,
      });
      return { tipo: "contenido", motivo: "TIMEOUT" };
    }
    return salida;
  } catch (error) {
    logError("error", { socioId: input.socioId, accion: input.accion, error });
    return { tipo: "contenido", motivo: "ERROR" };
  }
}

export interface SugerenciaSinReserva {
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string | null;
  esperaSegundos: number;
}

/**
 * Siguiente ejercicio en orden de rutina, para la lectura informativa de la API.
 * Sin lock y sin escritura: si el motor no puede decidir, degrada a `null`.
 */
export async function calcularSinReservar(
  input: { socioId: string; ahora: Date },
  deps: Partial<DepsOrquestacion> = {}
): Promise<SugerenciaSinReserva | null> {
  const { repositorio, motor } = resolverDeps(deps);

  try {
    if (!(await repositorio.tieneRutinaActiva(input.socioId))) return null;

    const configuracion = await repositorio.leerConfiguracion();
    const leida = await repositorio.leerEntradaMotor({
      socioId: input.socioId,
      ahora: input.ahora,
      minutosInactividadSesion: configuracion.minutosInactividadSesion,
      excluirEjercicioIds: [],
    });
    if (!leida) return null;

    const resultado = motor(leida.entrada);
    if (resultado.tipo !== "exito") return null;

    const siguiente = resultado.siguienteEnOrden;
    const ejercicio = leida.rutina.ejercicios.find(
      (candidato) => candidato.ejercicioId === siguiente.ejercicioId
    );
    return {
      ejercicioId: siguiente.ejercicioId,
      ejercicioNombre: ejercicio?.nombre ?? "",
      maquinaId: siguiente.maquinaId,
      esperaSegundos: siguiente.espera,
    };
  } catch (error) {
    logError("error", {
      socioId: input.socioId,
      contexto: "calcularSinReservar",
      error,
    });
    return null;
  }
}

/** Gancho de check-in: best-effort, nunca lanza (P-64). */
export async function calcularEnCheckIn(
  input: { socioId: string; ahora: Date },
  deps: Partial<DepsOrquestacion> = {}
): Promise<void> {
  try {
    await calcularYReservar({ ...input, momento: "CHECK_IN" }, deps);
  } catch (error) {
    // `calcularYReservar` ya contiene lo suyo; esta red cubre fallos al resolver dependencias.
    logError("error", { socioId: input.socioId, momento: "CHECK_IN", error });
  }
}

export async function tieneRutinaActiva(
  socioId: string,
  deps: Partial<DepsOrquestacion> = {}
): Promise<boolean> {
  const { repositorio } = resolverDeps(deps);
  return repositorio.tieneRutinaActiva(socioId);
}

export async function resolverSocioDeUsuario(
  usuarioId: string,
  deps: Partial<DepsOrquestacion> = {}
): Promise<string | null> {
  const { repositorio } = resolverDeps(deps);
  return repositorio.resolverSocioPorUsuario(usuarioId);
}

export async function existeSocio(
  socioId: string,
  deps: Partial<DepsOrquestacion> = {}
): Promise<boolean> {
  const { repositorio } = resolverDeps(deps);
  return repositorio.existeSocio(socioId);
}
