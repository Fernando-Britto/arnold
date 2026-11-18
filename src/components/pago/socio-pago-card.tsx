import React from "react";
import type { EstadoCuotaSocio } from "@/domains/pago/cuota";
import type { SocioBusqueda } from "@/api/socios";
import { formatDNI, formatFechaCorta, formatMoney } from "@/utils/formatting";

const ESTADO_LABEL: Record<EstadoCuotaSocio, string> = {
  AL_DIA: "Al día",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
  SIN_CUOTA: "Sin cuota",
};

const ESTADO_CLASS: Record<EstadoCuotaSocio, string> = {
  AL_DIA: "text-success",
  PENDIENTE: "text-warning",
  VENCIDA: "text-danger",
  SIN_CUOTA: "text-ink-muted",
};

const Dato = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1">
    <dt className="text-sm text-ink-muted">{label}</dt>
    <dd className="text-sm font-medium text-ink">{children}</dd>
  </div>
);

export interface SocioPagoCardProps {
  socio: SocioBusqueda;
  /** Si se pasa, muestra la acción secundaria para volver a elegir el cliente. */
  onCambiarCliente?: () => void;
}

/**
 * Tarjeta del cliente seleccionado (T-033). Presentacional: muestra los datos de contacto,
 * la membresía, el estado de cuota, el vencimiento y el monto a cobrar. No llama a la API.
 */
export function SocioPagoCard({ socio, onCambiarCliente }: SocioPagoCardProps) {
  const sinMembresia = !socio.membresia;

  return (
    <section
      aria-label="Cliente seleccionado"
      className="flex h-full flex-col rounded-lg border border-border bg-surface p-4"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Cliente seleccionado
      </h3>
      <p className="mt-1 text-xl font-semibold text-ink">{socio.nombre}</p>

      <dl className="mt-3">
        <Dato label="DNI">{formatDNI(socio.dni)}</Dato>
        <Dato label="Email">{socio.email}</Dato>
        {socio.telefono && <Dato label="Teléfono">{socio.telefono}</Dato>}
        <Dato label="Membresía">
          {socio.membresia
            ? `${socio.membresia.nombre} - ${formatMoney(socio.membresia.precio)}`
            : "Sin membresía"}
        </Dato>
        <Dato label="Estado">
          {sinMembresia ? (
            <span className="text-ink-muted">Sin membresía</span>
          ) : (
            <span className={ESTADO_CLASS[socio.estadoCuota]}>
              {ESTADO_LABEL[socio.estadoCuota]}
            </span>
          )}
        </Dato>
        {socio.fechaVencimiento && (
          <Dato label="Vencimiento">{formatFechaCorta(socio.fechaVencimiento)}</Dato>
        )}
        <Dato label="Monto a cobrar">
          {socio.plan ? formatMoney(socio.oferta ? socio.oferta.montoFinal : socio.plan.monto) : "—"}
        </Dato>
        {socio.oferta && (
          <>
            <Dato label="Precio de lista">{formatMoney(socio.oferta.montoLista)}</Dato>
            <Dato label="Descuento">
              <span className="text-success">{`−${socio.oferta.descuentoPct} %`}</span>
            </Dato>
          </>
        )}
        {socio.plan && <Dato label="Período">{socio.plan.periodos.join(", ")}</Dato>}
      </dl>

      {!socio.membresia && (
        <p role="alert" className="mt-3 text-sm text-warning">
          El socio no tiene una membresía asignada: no se puede registrar un pago.
        </p>
      )}

      {onCambiarCliente && (
        <button
          type="button"
          onClick={onCambiarCliente}
          className="mt-auto self-start pt-4 text-sm font-medium text-brand hover:text-brand-deep hover:underline"
        >
          Cambiar cliente
        </button>
      )}
    </section>
  );
}
