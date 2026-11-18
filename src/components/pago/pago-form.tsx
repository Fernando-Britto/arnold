"use client";

import React, { useRef, useState } from "react";
import { fetchSocioPorId, type SocioBusqueda, type SocioResumen } from "@/api/socios";
import { createPago } from "@/api/pagos";
import { METODOS_PAGO, type MetodoPago } from "@/domains/pago/registrar-pago";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError, ApiError } from "@/utils/api-error";
import { formatMoney } from "@/utils/formatting";
import { SocioPagoCard } from "./socio-pago-card";
import { ClienteBusqueda } from "./cliente-busqueda";
import { PagosHistorial } from "./pagos-historial";

const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

/**
 * Formulario "Registrar Pago": busca un cliente por nombre, muestra la grilla, y al elegir una
 * fila pide la vista previa de cobro (plan de pago, D-40), elige el método y confirma contra
 * POST /api/pagos. Seleccionar un cliente nunca dispara el cobro.
 */
export function PagoForm() {
  const { notify } = useNotifications();

  const [seleccion, setSeleccion] = useState<SocioResumen | null>(null);
  const [socio, setSocio] = useState<SocioBusqueda | null>(null);
  const [cargandoSocio, setCargandoSocio] = useState(false);
  const [errorSocio, setErrorSocio] = useState<string | null>(null);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [confirmando, setConfirmando] = useState(false);
  const [refrescarToken, setRefrescarToken] = useState(0);

  // Última selección pedida: descarta la respuesta de una fila que ya no está elegida.
  const seleccionRef = useRef<string | null>(null);

  const seleccionar = async (resumen: SocioResumen) => {
    seleccionRef.current = resumen.id;
    setSeleccion(resumen);
    setSocio(null);
    setErrorSocio(null);
    setErrorPago(null);
    setCargandoSocio(true);
    try {
      const data = await fetchSocioPorId(resumen.id);
      if (seleccionRef.current !== resumen.id) return;
      setSocio(data);
    } catch (err) {
      if (seleccionRef.current !== resumen.id) return;
      setErrorSocio(handleApiError(err, "No se pudo cargar el cliente."));
    } finally {
      if (seleccionRef.current === resumen.id) setCargandoSocio(false);
    }
  };

  const cambiarCliente = () => {
    seleccionRef.current = null;
    setSeleccion(null);
    setSocio(null);
    setErrorSocio(null);
    setErrorPago(null);
    setCargandoSocio(false);
  };

  // Refresca la vista previa del socio sin cambiar la selección (tras cobrar o anular).
  const recargarSocio = async (socioId: string) => {
    try {
      const data = await fetchSocioPorId(socioId);
      if (seleccionRef.current === socioId) setSocio(data);
    } catch {
      // Si el refresco falla, se mantiene lo que ya se veía.
    }
  };

  const confirmar = async () => {
    if (!socio || !socio.membresia || !socio.plan) return;

    const socioId = socio.id;
    // El monto que el recepcionista vio (oferta aplicada si la hay): con él el servidor detecta
    // si cambió entre la vista previa y el cobro.
    const montoEsperado = socio.oferta ? socio.oferta.montoFinal : socio.plan.monto;

    setErrorPago(null);
    setConfirmando(true);
    try {
      const resultado = await createPago({ socioId, metodoPago: metodo, montoEsperado });
      const periodos = resultado.plan.periodos.join(", ");
      notify(
        "success",
        `Pago registrado: ${formatMoney(resultado.plan.monto)} · Período ${periodos}`
      );
      setMetodo("EFECTIVO");
      // La grilla refleja el nuevo estado/vencimiento y la tarjeta se refresca; el cliente sigue
      // seleccionado.
      setRefrescarToken((token) => token + 1);
      await recargarSocio(socioId);
    } catch (err) {
      setErrorPago(handleApiError(err, "No se pudo registrar el pago."));
      // El monto cambió entre la vista previa y el cobro (p. ej. la oferta se apagó): refrescamos
      // la vista previa con el monto vigente. No reintentamos el cobro por nuestra cuenta.
      if (err instanceof ApiError && err.code === "AMOUNT_CHANGED") {
        await recargarSocio(socioId);
      }
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <ClienteBusqueda
        seleccionadoId={seleccion?.id ?? null}
        onSeleccionar={seleccionar}
        refrescarToken={refrescarToken}
      />

      {seleccion && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col">
            {cargandoSocio ? (
              <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
                <p role="status" className="text-sm text-ink-muted">
                  Cargando cliente…
                </p>
              </div>
            ) : errorSocio ? (
              <p
                role="alert"
                className="rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm text-danger"
              >
                {errorSocio}
              </p>
            ) : socio ? (
              <SocioPagoCard socio={socio} onCambiarCliente={cambiarCliente} />
            ) : null}
          </div>

          {socio && (
            <section
              aria-label="Formulario de pago"
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-ink">Datos del pago</h3>

              {errorPago && (
                <p
                  role="alert"
                  className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger"
                >
                  {errorPago}
                </p>
              )}

              <div>
                <label htmlFor="pago-metodo" className="mb-1 block text-sm font-medium text-ink-soft">
                  Método de pago
                </label>
                <select
                  id="pago-metodo"
                  name="metodoPago"
                  value={metodo}
                  onChange={(event) => setMetodo(event.target.value as MetodoPago)}
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
                onClick={confirmar}
                disabled={confirmando || !socio.membresia}
                className="rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
              >
                {confirmando ? "Registrando..." : "Registrar pago"}
              </button>
            </section>
          )}
        </div>
      )}

      {socio && (
        <PagosHistorial
          socioId={socio.id}
          refrescarToken={refrescarToken}
          onAnulado={() => {
            recargarSocio(socio.id);
            // Anular reabre el período: la grilla también tiene que reflejarlo.
            setRefrescarToken((token) => token + 1);
          }}
        />
      )}
    </div>
  );
}
