"use client";

/**
 * Estado de lectura de la sugerencia de asignación para la home del socio (T-057b, D-119/D-120).
 *
 * Consulta al montar, al volver la pestaña a visible y cuando se pide a mano. Sin polling y sin cache:
 * la reserva vence, así que un valor guardado ofrecería acciones sobre algo muerto. Cada consulta
 * cancela la anterior y solo la última escribe el estado, para que una respuesta vieja no pise a la nueva.
 *
 * La decisión (`ACEPTAR`/`ESPERAR`) invalida cualquier lectura en vuelo: la respuesta de la decisión manda
 * y una lectura vieja no puede pisarla (D-120).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { decidirSugerencia, fetchSugerencia, type AccionDeSugerencia } from "@/api/asignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { SiguienteDTO, SugerenciaDTO } from "@/api/asignaciones";

export type EstadoSugerencia =
  | { tipo: "cargando" }
  | { tipo: "lista"; sugerencia: SugerenciaDTO | null; siguienteEnOrden: SiguienteDTO | null }
  | { tipo: "aceptada"; sugerencia: SugerenciaDTO }
  | { tipo: "vencida" }
  | { tipo: "error" };

export interface UsoSugerenciaAsignacion {
  estado: EstadoSugerencia;
  /** Hay un `POST` de decisión en vuelo: los botones se deshabilitan. */
  enviando: boolean;
  /** Hay un `GET` en vuelo: el botón de recarga se deshabilita mientras consulta. */
  consultando: boolean;
  consultar: () => void;
  decidir: (accion: AccionDeSugerencia) => Promise<void>;
}

export function useSugerenciaAsignacion(): UsoSugerenciaAsignacion {
  const [estado, setEstado] = useState<EstadoSugerencia>({ tipo: "cargando" });
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);

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

  const ejecutarConsulta = useCallback(() => {
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
      })
      .finally(() => {
        // Solo la consulta vigente apaga el indicador; una vieja no debe pisar a la nueva.
        if (montado.current && id === ultimaConsulta.current) setConsultando(false);
      });
  }, []);

  useEffect(() => {
    // Carga inicial: la tarjeta ya muestra su estado `cargando`, así que no hace falta el flag.
    ejecutarConsulta();
  }, [ejecutarConsulta]);

  const consultar = useCallback(() => {
    setConsultando(true);
    ejecutarConsulta();
  }, [ejecutarConsulta]);

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") consultar();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }, [consultar]);

  const decidir = useCallback(
    async (accion: AccionDeSugerencia) => {
      if (enviando) return;
      setEnviando(true);
      // Invalida la lectura en vuelo: la decisión manda sobre cualquier GET anterior (D-120).
      enVuelo.current?.abort();
      ultimaConsulta.current += 1;

      try {
        const respuesta = await decidirSugerencia(accion);
        if (!montado.current) return;
        if (respuesta.sugerencia) {
          setEstado({ tipo: "aceptada", sugerencia: respuesta.sugerencia });
        } else {
          setEstado({ tipo: "lista", sugerencia: null, siguienteEnOrden: respuesta.siguienteEnOrden });
        }
        if (accion === "ESPERAR") consultar();
      } catch (error) {
        if (!montado.current) return;
        const caducada = error instanceof ApiError && (error.status === 409 || error.status === 404);
        setEstado({ tipo: caducada ? "vencida" : "error" });
        if (caducada) consultar();
      } finally {
        if (montado.current) setEnviando(false);
      }
    },
    [consultar, enviando]
  );

  return { estado, enviando, consultando, consultar, decidir };
}
