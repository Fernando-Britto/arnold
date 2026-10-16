"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  eliminarHuella,
  fetchEstadoHuella,
  registrarHuella,
  type EstadoHuella,
} from "@/api/huellas-client";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";

/** Polling de una solicitud PENDIENTE: cada 2 s, con un tope de 60 s. */
const POLL_MS = 2000;
const POLL_TOPE_MS = 60_000;

/** Motivos que reporta el sensor (`.ino`), traducidos a texto legible. */
const MOTIVOS: Record<string, string> = {
  duplicado: "Esa huella ya estaba registrada",
  timeout: "El sensor no detectó el dedo",
  no_coinciden: "Las dos lecturas no coincidieron",
  error_guardado: "No se pudo guardar en el sensor",
  error_borrado: "El sensor no pudo borrar la huella",
  reemplazada: "Reemplazada por un enrolamiento nuevo",
};

function motivoLegible(motivo: string | null): string {
  if (!motivo) return "Error desconocido";
  return MOTIVOS[motivo] ?? motivo;
}

function textoFallida(accion: "ENROLAR" | "BORRAR", motivo: string | null): string {
  const prefijo = accion === "ENROLAR" ? "No se pudo registrar la huella" : "No se pudo eliminar la huella";
  return `${prefijo}: ${motivoLegible(motivo)}`;
}

export interface PanelHuellaProps {
  socioId: string;
  socioNombre?: string;
}

/**
 * Panel de huella del socio seleccionado en /clientes (T-041, D-43/D-47).
 *
 * El enrolamiento y la baja son asincrónicos: el panel encola la solicitud y sigue su estado por
 * polling hasta que el sensor la resuelve. Sin estado global ni dependencias nuevas.
 */
export function PanelHuella({ socioId, socioNombre }: PanelHuellaProps) {
  const { notify } = useNotifications();

  const [estado, setEstado] = useState<EstadoHuella | null>(null);
  const [consentimiento, setConsentimiento] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agotado, setAgotado] = useState(false);

  // Carga inicial y al cambiar de socio. Sin `setState` síncrono en el efecto: el arranque
  // queda en `null` y sólo los callbacks de la promesa actualizan el estado.
  useEffect(() => {
    let cancelado = false;
    fetchEstadoHuella(socioId)
      .then((nuevo) => {
        if (!cancelado) setEstado(nuevo);
      })
      .catch((err) => {
        if (!cancelado) setError(handleApiError(err, "No se pudo consultar la huella."));
      });
    return () => {
      cancelado = true;
    };
  }, [socioId]);

  const notificarResultado = useCallback(
    (nuevo: EstadoHuella) => {
      const solicitud = nuevo.solicitud;
      if (!solicitud) return;
      if (solicitud.estado === "CONFIRMADA") {
        notify(
          "success",
          solicitud.accion === "ENROLAR" ? `Huella registrada (ID ${solicitud.huellaId})` : "Huella eliminada"
        );
      } else if (solicitud.estado === "FALLIDA") {
        notify("error", textoFallida(solicitud.accion, solicitud.motivo));
      }
    },
    [notify]
  );

  const pendiente = estado?.solicitud?.estado === "PENDIENTE";

  // Polling mientras haya una solicitud PENDIENTE y no se haya agotado el tope.
  useEffect(() => {
    if (!pendiente || agotado) return;
    const inicio = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - inicio >= POLL_TOPE_MS) {
        clearInterval(timer);
        setAgotado(true);
        return;
      }
      fetchEstadoHuella(socioId)
        .then((nuevo) => {
          if (nuevo.solicitud?.estado !== "PENDIENTE") {
            setEstado(nuevo);
            notificarResultado(nuevo);
          }
        })
        .catch(() => {
          // El sensor puede responder tarde; seguimos intentando hasta el tope.
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendiente, agotado, socioId, notificarResultado]);

  const refetch = async () => setEstado(await fetchEstadoHuella(socioId));

  const handleRegistrar = async () => {
    setError(null);
    setAgotado(false);
    setAccionando(true);
    try {
      await registrarHuella(socioId);
      notify("info", "Enrolamiento enviado; acercá el dedo al lector");
      setConsentimiento(false);
      await refetch();
    } catch (err) {
      setError(handleApiError(err, "No se pudo registrar la huella."));
    } finally {
      setAccionando(false);
    }
  };

  const handleEliminar = async () => {
    if (typeof window !== "undefined" && !window.confirm("¿Eliminar la huella del socio?")) return;
    setError(null);
    setAgotado(false);
    setAccionando(true);
    try {
      await eliminarHuella(socioId);
      notify("info", "Baja de huella enviada al sensor");
      await refetch();
    } catch (err) {
      setError(handleApiError(err, "No se pudo eliminar la huella."));
    } finally {
      setAccionando(false);
    }
  };

  const ariaLabel = socioNombre ? `Huella de ${socioNombre}` : "Huella";

  if (!estado) {
    return (
      <section aria-label={ariaLabel} className="flex flex-col gap-3 border-t border-[#E4E4E7] pt-4">
        <h3 className="text-sm font-bold uppercase text-[#71717A]">Huella</h3>
        {error ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <p className="text-sm text-gray-500">Consultando estado de la huella…</p>
        )}
      </section>
    );
  }

  return (
    <section aria-label={ariaLabel} className="flex flex-col gap-3 border-t border-[#E4E4E7] pt-4">
      <h3 className="text-sm font-bold uppercase text-[#71717A]">Huella</h3>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {pendiente ? (
        agotado ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-amber-800">El sensor no respondió; podés reintentar.</p>
            <button
              type="button"
              onClick={() => setAgotado(false)}
              className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00]"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <p role="status" className="text-sm text-gray-700">
            Esperando al sensor… (acercá el dedo al lector)
          </p>
        )
      ) : estado.huellaId != null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-900">Huella registrada (ID {estado.huellaId})</p>
          <button
            type="button"
            onClick={handleEliminar}
            disabled={accionando}
            className="rounded border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accionando ? "Eliminando…" : "Eliminar huella"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {estado.solicitud?.estado === "FALLIDA" && (
            <p role="status" className="text-sm text-red-700">
              {textoFallida(estado.solicitud.accion, estado.solicitud.motivo)}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
              className="mt-0.5"
            />
            El socio firmó el consentimiento informado
          </label>
          <button
            type="button"
            onClick={handleRegistrar}
            disabled={!consentimiento || accionando}
            className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {accionando ? "Enviando…" : "Registrar huella"}
          </button>
        </div>
      )}
    </section>
  );
}
