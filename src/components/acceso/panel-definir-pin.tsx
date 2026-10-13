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
      className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 id="definir-pin-titulo" className="text-lg font-semibold text-gray-900">
        Definir PIN
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Uso exclusivo del personal de recepción. Definí el PIN de 4 dígitos para el ingreso por DNI + PIN.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleBuscar} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="definir-pin-dni" className="mb-1 block text-sm font-medium text-gray-700">
            DNI
          </label>
          <input
            id="definir-pin-dni"
            name="dni"
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="XX.XXX.XXX o XXXXXXXX"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {socio && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">{socio.nombre}</p>
            {socio.membresia && <p className="text-sm text-gray-600">{socio.membresia.nombre}</p>}
          </div>

          <div>
            <label htmlFor="definir-pin-valor" className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Se usa para el ingreso por DNI + PIN.</p>
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || pin.length !== LARGO_PIN}
            className="self-start rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {guardando ? "Guardando..." : "Guardar PIN"}
          </button>
        </div>
      )}
    </section>
  );
}
