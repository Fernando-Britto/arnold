"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { requestAccessOverride } from "@/api/socios/access-override";
import { handleApiError } from "@/utils/api-error";
import { useModalA11y } from "@/hooks/use-modal-a11y";

/** Reglas del motivo (spec manual-override-authorization: mínimo 10, máximo 500). */
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;

/** Datos del socio que el override necesita para apuntar a quién se le otorga el acceso. */
export interface SocioOverride {
  id: string;
  nombre?: string;
  membresia?: string | null;
}

export interface OverrideAccesoProps {
  socio: SocioOverride;
  /** Motivo de la denegación que se muestra en el diálogo (p. ej. "Cuota vencida"). */
  motivoDenegacion?: string;
  /** Estado controlado del diálogo (el kiosco lo pausa para no limpiar la pantalla al abrirlo). */
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Se ejecuta tras un override exitoso para que el kiosco refresque el estado del check-in. */
  onOtorgado: () => void;
}

/** Devuelve el mensaje de validación del motivo, o `null` si es válido. */
export function validarMotivoOverride(motivo: string): string | null {
  const recortado = motivo.trim();
  if (recortado.length === 0) return "El motivo es requerido";
  if (recortado.length < MOTIVO_MIN) return `El motivo debe tener al menos ${MOTIVO_MIN} caracteres`;
  if (motivo.length > MOTIVO_MAX) return `El motivo no puede superar los ${MOTIVO_MAX} caracteres`;
  return null;
}

/**
 * Acción manual del ADMINISTRADOR (AC-3 / módulo 9). Muestra "Otorgar acceso (override)" y un
 * diálogo accesible (`useModalA11y`: Esc, focus-trap y retorno de foco) que exige un motivo
 * válido antes de llamar a `requestAccessOverride`. Sólo se renderiza para ADMINISTRADOR; la API
 * vuelve a exigir el rol (defensa en profundidad).
 */
export function OverrideAcceso({
  socio,
  motivoDenegacion,
  abierto,
  onAbiertoChange,
  onOtorgado,
}: OverrideAccesoProps) {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [motivo, setMotivo] = useState("");
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    setMotivo("");
    setErrorServidor(null);
    onAbiertoChange(false);
  };

  const dialogRef = useModalA11y<HTMLDivElement>(abierto, cerrar);

  // El chequeo de rol ocurre después de los hooks para no romper su orden entre renders.
  if (user?.rol !== "ADMINISTRADOR") return null;

  const errorValidacion = validarMotivoOverride(motivo);
  const mensajeError = errorServidor ?? (motivo.length > 0 ? errorValidacion : null);

  const otorgar = async () => {
    if (errorValidacion !== null || enviando) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      const respuesta = await requestAccessOverride(socio.id, motivo);
      notify("success", respuesta.message || "Acceso otorgado");
      cerrar();
      onOtorgado();
    } catch (error) {
      setErrorServidor(handleApiError(error, "No se pudo otorgar el acceso."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onAbiertoChange(true)}
        className="rounded-lg bg-brand-strong px-8 py-3 text-lg font-semibold text-surface hover:bg-brand-deep"
      >
        Otorgar acceso (override)
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Otorgar acceso excepcional"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div ref={dialogRef} className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-ink">Otorgar acceso excepcional</h2>
            {socio.nombre && <p className="mt-1 text-sm text-ink-muted">{socio.nombre}</p>}
            {motivoDenegacion && (
              <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                Motivo de la denegación: {motivoDenegacion}
              </p>
            )}

            <label
              htmlFor="override-motivo"
              className="mt-4 block text-sm font-medium text-ink"
            >
              Motivo de la autorización (mínimo {MOTIVO_MIN} caracteres)
            </label>
            <textarea
              id="override-motivo"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErrorServidor(null);
              }}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />

            {mensajeError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {mensajeError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={cerrar}
                disabled={enviando}
                className="rounded-lg border border-border bg-surface px-5 py-2 font-semibold text-ink-soft hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={otorgar}
                disabled={errorValidacion !== null || enviando}
                className="rounded-lg bg-brand-strong px-5 py-2 font-semibold text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
              >
                {enviando ? "Otorgando..." : "Otorgar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
