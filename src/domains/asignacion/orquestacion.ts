import type { AsignacionPort } from "./asignacion-puerto";
import { asignacionRepository } from "./asignacion-repositorio";
import { calcularEspera } from "./motor-espera";

export const TIMEOUT_CALCULO_MS = 2000;
export const MARGEN_RESPUESTA_MS = 250;
const MAX_WAIT_TRANSACCION_MS = 1000;

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

export interface DepsOrquestacion {
  repositorio: AsignacionPort;
  motor: typeof calcularEspera;
}

const TIMEOUT = Symbol("timeout");

function resolverDeps(deps: Partial<DepsOrquestacion>): DepsOrquestacion {
  return {
    repositorio: deps.repositorio ?? asignacionRepository,
    motor: deps.motor ?? calcularEspera,
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
  const { repositorio, motor } = resolverDeps(deps);

  try {
    return await calcularSeguro(input, repositorio, motor);
  } catch (error) {
    logError("error", { socioId: input.socioId, momento: input.momento, error });
    return { tipo: "contenido", motivo: "ERROR" };
  }
}

async function calcularSeguro(
  input: CalcularYReservarInput,
  repositorio: AsignacionPort,
  motor: typeof calcularEspera
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
    { maxWait: MAX_WAIT_TRANSACCION_MS, timeout: TIMEOUT_CALCULO_MS }
  );

  const salida = await conTimeout(trabajo, TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS);
  if (salida === TIMEOUT) {
    logError("timeout", {
      socioId: input.socioId,
      momento: input.momento,
      timeoutMs: TIMEOUT_CALCULO_MS + MARGEN_RESPUESTA_MS,
    });
    return { tipo: "contenido", motivo: "TIMEOUT" };
  }
  return salida;
}
