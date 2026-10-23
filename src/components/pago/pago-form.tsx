"use client";

import React, { useState } from "react";
import { fetchSocioPorDni, type SocioBusqueda } from "@/api/socios";
import { createPago } from "@/api/pagos";
import { METODOS_PAGO, type MetodoPago } from "@/domains/pago/registrar-pago";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError, ApiError } from "@/utils/api-error";
import { formatMoney } from "@/utils/formatting";
import { SocioPagoCard } from "./socio-pago-card";
import { PagosHistorial } from "./pagos-historial";

const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

/**
 * Formulario "Registrar Pago" (T-033): busca un socio por DNI, previsualiza el monto
 * a cobrar (plan de pago, D-40), elige el método y confirma contra POST /api/pagos.
 */
export function PagoForm() {
  const { notify } = useNotifications();

  const [dni, setDni] = useState("");
  const [socio, setSocio] = useState<SocioBusqueda | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [buscando, setBuscando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
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

  const handleConfirmar = async () => {
    if (!socio || !socio.membresia || !socio.plan) return;

    // El monto que el recepcionista vio (oferta aplicada si la hay): con él el servidor detecta
    // si cambió entre la vista previa y el cobro.
    const montoEsperado = socio.oferta ? socio.oferta.montoFinal : socio.plan.monto;

    setError(null);
    setConfirmando(true);
    try {
      const resultado = await createPago({ socioId: socio.id, metodoPago: metodo, montoEsperado });
      const periodos = resultado.plan.periodos.join(", ");
      notify(
        "success",
        `Pago registrado: ${formatMoney(resultado.plan.monto)} · Período ${periodos}`
      );
      setSocio(null);
      setDni("");
      setMetodo("EFECTIVO");
    } catch (err) {
      setError(handleApiError(err, "No se pudo registrar el pago."));
      // El monto cambió entre la vista previa y el cobro (p. ej. la oferta se apagó): refrescamos
      // la vista previa con el monto vigente. No reintentamos el cobro por nuestra cuenta.
      if (err instanceof ApiError && err.code === "AMOUNT_CHANGED") {
        try {
          setSocio(await fetchSocioPorDni(socio.dni));
        } catch {
          // Si la actualización falla, se mantiene el aviso del monto cambiado.
        }
      }
    } finally {
      setConfirmando(false);
    }
  };

  // Tras anular un pago, el estado de pago y el plan a cobrar pueden cambiar (se vuelve a pedir
  // el período). Se refresca la tarjeta del socio además de la lista.
  const recargarSocio = async () => {
    if (!socio) return;
    try {
      setSocio(await fetchSocioPorDni(socio.dni));
    } catch {
      // Si el refresco falla, se mantiene lo que ya se veía.
    }
  };

  return (
    <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Registrar Pago</h2>

      {error && (
        <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleBuscar} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="pago-dni" className="mb-1 block text-sm font-medium text-ink-soft">
            DNI
          </label>
          <input
            id="pago-dni"
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
        <>
          <SocioPagoCard socio={socio} />

          <PagosHistorial socioId={socio.id} onAnulado={recargarSocio} />

          <div>
            <label htmlFor="pago-metodo" className="mb-1 block text-sm font-medium text-ink-soft">
              Método de pago
            </label>
            <select
              id="pago-metodo"
              name="metodoPago"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPago)}
              className="w-full rounded-md border border-border px-3 py-2"
            >
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {METODO_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirmando || !socio.membresia}
            className="rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
          >
            {confirmando ? "Registrando..." : "Confirmar pago"}
          </button>
        </>
      )}
    </div>
  );
}
