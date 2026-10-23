"use client";

import React, { useState } from "react";
import { fetchSocioPorDni, type SocioBusqueda } from "@/api/socios";
import { setPin as definirPin } from "@/api/acceso";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";

const LARGO_PIN = 4;

/**
 * Panel "Definir PIN" (T-035, D-47): el personal de recepción busca al socio por DNI
 * y le define el PIN de 4 dígitos que después usa en el kiosco. Separado del check-in:
 * se abre a propósito desde /acceso y nunca queda a la vista del socio.
 */
export function PanelDefinirPin() {
  const { notify } = useNotifications();

  const [dni, setDni] = useState("");
  const [socio, setSocio] = useState<SocioBusqueda | null>(null);
  const [pin, setPin] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuscar = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSocio(null);

    const consulta = dni.trim();
    if (!consulta) {
      setError("Ingresá un DNI para buscar.");
      return;
    }

    setBuscando(true);
    try {
      setSocio(await fetchSocioPorDni(consulta));
    } catch (err) {
      setError(handleApiError(err, "No se pudo buscar el socio."));
    } finally {
      setBuscando(false);
    }
  };

  const handleGuardar = async () => {
    if (!socio || pin.length !== LARGO_PIN) return;

    setError(null);
    setGuardando(true);
    try {
      await definirPin(socio.id, pin);
      notify("success", "PIN definido correctamente");
      setSocio(null);
      setDni("");
      setPin("");
    } catch (err) {
      setError(handleApiError(err, "No se pudo definir el PIN."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      aria-labelledby="definir-pin-titulo"
      className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="definir-pin-titulo" className="text-lg font-semibold text-ink">
        Definir PIN
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Uso exclusivo del personal de recepción. Definí el PIN de 4 dígitos para el ingreso por DNI + PIN.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleBuscar} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="definir-pin-dni" className="mb-1 block text-sm font-medium text-ink-soft">
            DNI
          </label>
          <input
            id="definir-pin-dni"
            name="dni"
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="XX.XXX.XXX o XXXXXXXX"
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {socio && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-md border border-border bg-surface-hover p-3">
            <p className="font-semibold text-ink">{socio.nombre}</p>
            {socio.membresia && <p className="text-sm text-ink-muted">{socio.membresia.nombre}</p>}
          </div>

          <div>
            <label htmlFor="definir-pin-valor" className="mb-1 block text-sm font-medium text-ink-soft">
              PIN (4 dígitos)
            </label>
            <input
              id="definir-pin-valor"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={LARGO_PIN}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, LARGO_PIN))}
              placeholder="••••"
              className="w-full rounded-md border border-border px-3 py-2"
            />
            <p className="mt-1 text-xs text-ink-muted">Se usa para el ingreso por DNI + PIN.</p>
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || pin.length !== LARGO_PIN}
            className="self-start rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
          >
            {guardando ? "Guardando..." : "Guardar PIN"}
          </button>
        </div>
      )}
    </section>
  );
}
