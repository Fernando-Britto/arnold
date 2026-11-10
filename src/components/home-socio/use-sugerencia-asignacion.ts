"use client";

/**
 * Estado de lectura de la sugerencia de asignación para la home del socio (T-057b, D-119/D-120).
 *
 * Consulta al montar, al volver la pestaña a visible y cuando se pide a mano. Sin polling y sin cache:
 * la reserva vence, así que un valor guardado ofrecería acciones sobre algo muerto. Cada consulta
 * cancela la anterior y solo la última escribe el estado, para que una respuesta vieja no pise a la nueva.
 *
 * La decisión (`ACEPTAR`/`ESPERAR`) y el estado `enviando` viven en S3 (T-057e).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSugerencia } from "@/api/asignaciones-cliente";
import type { SiguienteDTO, SugerenciaDTO } from "@/api/asignaciones";

export type EstadoSugerencia =
  | { tipo: "cargando" }
  | { tipo: "lista"; sugerencia: SugerenciaDTO | null; siguienteEnOrden: SiguienteDTO | null }
  | { tipo: "error" };

export interface UsoSugerenciaAsignacion {
  estado: EstadoSugerencia;
  consultar: () => void;
}

export function useSugerenciaAsignacion(): UsoSugerenciaAsignacion {
  const [estado, setEstado] = useState<EstadoSugerencia>({ tipo: "cargando" });

  const montado = useRef(true);
  const enVuelo = useRef<AbortController | null>(null);
  const ultimaConsulta = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      enVuelo.current?.abort();
    };
  }, []);

  const consultar = useCallback(() => {
    enVuelo.current?.abort();
    const controlador = new AbortController();
    enVuelo.current = controlador;
    const id = ultimaConsulta.current + 1;
    ultimaConsulta.current = id;

    fetchSugerencia(controlador.signal)
      .then((respuesta) => {
        if (!montado.current || id !== ultimaConsulta.current) return;
        setEstado({ tipo: "lista", sugerencia: respuesta.sugerencia, siguienteEnOrden: respuesta.siguienteEnOrden });
      })
      .catch((error: unknown) => {
        if (!montado.current || id !== ultimaConsulta.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEstado({ tipo: "error" });
      });
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") consultar();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }, [consultar]);

  return { estado, consultar };
}
