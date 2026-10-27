import type { Configuracion } from "@/lib/configuracion";
import type { AsignacionPort } from "./asignacion-puerto";
import { asignacionRepository } from "./asignacion-repositorio";
import { calcularEspera } from "./motor-espera";

export const TIMEOUT_CALCULO_MS = 2000;
export const MARGEN_RESPUESTA_MS = 250;

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

function resolverDeps(deps: Partial<DepsOrquestacion>): DepsOrquestacion {
  return {
    repositorio: deps.repositorio ?? asignacionRepository,
    motor: deps.motor ?? calcularEspera,
  };
}

function minutosEnMs(minutos: number): number {
  return minutos * 60_000;
}

/**
 * Calcula la sugerencia y persiste la reserva dentro de una transacción con el advisory lock global.
 * El `ahora` y el motor son inyectables: la orquestación no lee el reloj.
 */
export async function calcularYReservar(
  input: CalcularYReservarInput,
  deps: Partial<DepsOrquestacion> = {}
): Promise<ResultadoOrquestacion> {
  const { repositorio, motor } = resolverDeps(deps);

  return repositorio.enTransaccionBloqueada(
    async (tx) => {
      const configuracion: Configuracion = await tx.leerConfiguracion();
      const leida = await tx.leerEntradaMotor({
        socioId: input.socioId,
        ahora: input.ahora,
        minutosInactividadSesion: configuracion.minutosInactividadSesion,
        excluirEjercicioIds: input.excluirEjercicioIds ?? [],
      });
      if (!leida) {
        throw new Error("[ASIGNACION] sin rutina activa dentro de la transacción");
      }

      const resultado = motor(leida.entrada);
      if (resultado.tipo !== "exito") {
        throw new Error(`[ASIGNACION] resultado no soportado todavía: ${resultado.tipo}`);
      }

      const venceEn = new Date(
        input.ahora.getTime() + minutosEnMs(configuracion.minutosVencimientoReserva)
      );

      await tx.cancelarReservasActivas(input.socioId, input.ahora);
      const reserva = await tx.crearReserva({
        socioId: input.socioId,
        ejercicioId: resultado.recomendado.ejercicioId,
        maquinaId: resultado.recomendado.maquinaId ?? "",
        esperaSegundos: resultado.recomendado.espera,
        ahorroSegundos: resultado.ahorro,
        creadaEn: input.ahora,
        venceEn,
      });

      return {
        tipo: "reservada",
        asignacionId: reserva.id,
        ejercicioId: resultado.recomendado.ejercicioId,
        maquinaId: resultado.recomendado.maquinaId ?? "",
        esperaSegundos: resultado.recomendado.espera,
        ahorroSegundos: resultado.ahorro,
        venceEn,
      };
    },
    { maxWait: 1000, timeout: TIMEOUT_CALCULO_MS }
  );
}
