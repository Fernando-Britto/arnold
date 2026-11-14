/**
 * Reasignación de máquina por instructor (P-61, D-125).
 *
 * Cambia la máquina de una ejecución `EN_CURSO` sin tocar la sesión del socio: cancela la fila y crea otra
 * del **mismo** ejercicio con la máquina elegida, en una sola transacción. Todo lo que escribe pasa por
 * `enTransaccionBloqueada` (lock global, D-130) y la auditoría se escribe dentro (D-128).
 *
 * La sesión (`ejercicioActualId`, `serieActual`) y los registros de progreso no se tocan: eso es D-127.
 */

export type CodigoReasignacion =
  | "ASIGNACION_NO_ENCONTRADA"
  | "ASIGNACION_YA_TERMINADA"
  | "MAQUINA_NO_CANDIDATA"
  | "MAQUINA_NO_DISPONIBLE"
  | "MAQUINA_OCUPADA";

import type { EstadoMaquina } from "./motor-espera";

export interface EntradaReasignacion {
  asignacionId: string;
  maquinaDestinoId: string;
  responsableId: string;
  ahora: Date;
}

export interface EjecucionEnCurso {
  id: string;
  socioId: string;
  sesionId: string;
  ejercicioId: string;
  maquinaId: string | null;
}

export interface TxReasignacion {
  leerEjecucion(id: string): Promise<EjecucionEnCurso | null>;
  leerSesion(sesionId: string): Promise<{ id: string; ejercicioActualId: string | null } | null>;
  esCandidata(ejercicioId: string, maquinaId: string): Promise<boolean>;
  leerMaquina(
    maquinaId: string
  ): Promise<{ id: string; nombre: string; estado: EstadoMaquina } | null>;
  maquinaOcupada(maquinaId: string, socioId: string, ahora: Date): Promise<boolean>;
  cancelarEjecucion(id: string, sesionId: string): Promise<boolean>;
  crearEjecucionEnCurso(datos: {
    socioId: string;
    sesionId: string;
    ejercicioId: string;
    maquinaId: string;
    ahora: Date;
  }): Promise<{ id: string }>;
  registrarAuditoria(datos: { responsableId: string; detalles: Record<string, unknown> }): Promise<void>;
}

export interface PuertoReasignacion {
  enTransaccionBloqueada<T>(fn: (tx: TxReasignacion) => Promise<T>): Promise<T>;
}

export type ResultadoReasignacion =
  | { tipo: "ok"; asignacionId: string; maquinaId: string; maquinaNombre: string | null }
  | { tipo: "error"; codigo: CodigoReasignacion };

function error(codigo: CodigoReasignacion): ResultadoReasignacion {
  return { tipo: "error", codigo };
}

/** Cambia la máquina de una ejecución `EN_CURSO`. Devuelve el resultado; solo lanza si la transacción falla. */
export async function reasignarMaquina(
  entrada: EntradaReasignacion,
  puerto: PuertoReasignacion
): Promise<ResultadoReasignacion> {
  return puerto.enTransaccionBloqueada(async (tx) => {
    const ejecucion = await tx.leerEjecucion(entrada.asignacionId);
    if (!ejecucion) return error("ASIGNACION_NO_ENCONTRADA");

    const sesion = await tx.leerSesion(ejecucion.sesionId);
    if (!sesion || sesion.ejercicioActualId !== ejecucion.ejercicioId) {
      return error("ASIGNACION_YA_TERMINADA");
    }

    if (!(await tx.esCandidata(ejecucion.ejercicioId, entrada.maquinaDestinoId))) {
      return error("MAQUINA_NO_CANDIDATA");
    }

    const maquina = await tx.leerMaquina(entrada.maquinaDestinoId);
    if (!maquina || maquina.estado !== "DISPONIBLE") {
      return error("MAQUINA_NO_DISPONIBLE");
    }

    if (await tx.maquinaOcupada(entrada.maquinaDestinoId, ejecucion.socioId, entrada.ahora)) {
      return error("MAQUINA_OCUPADA");
    }

    // El guard es la última defensa: si el socio completó el ejercicio en el medio, no se escribe nada.
    if (!(await tx.cancelarEjecucion(ejecucion.id, ejecucion.sesionId))) {
      return error("ASIGNACION_YA_TERMINADA");
    }

    const nueva = await tx.crearEjecucionEnCurso({
      socioId: ejecucion.socioId,
      sesionId: ejecucion.sesionId,
      ejercicioId: ejecucion.ejercicioId,
      maquinaId: maquina.id,
      ahora: entrada.ahora,
    });

    await tx.registrarAuditoria({
      responsableId: entrada.responsableId,
      detalles: {
        socioId: ejecucion.socioId,
        ejercicioId: ejecucion.ejercicioId,
        asignacionOrigenId: ejecucion.id,
        maquinaOrigenId: ejecucion.maquinaId,
        maquinaDestinoId: maquina.id,
      },
    });

    return { tipo: "ok", asignacionId: nueva.id, maquinaId: maquina.id, maquinaNombre: maquina.nombre };
  });
}
