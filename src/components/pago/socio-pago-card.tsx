import React from "react";
import type { EstadoCuotaSocio } from "@/domains/pago/cuota";
import type { SocioBusqueda } from "@/api/socios";
import { formatDNI, formatMoney } from "@/utils/formatting";

const ESTADO_LABEL: Record<EstadoCuotaSocio, string> = {
  AL_DIA: "Al día",
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
  SIN_CUOTA: "Sin cuota",
};

const ESTADO_CLASS: Record<EstadoCuotaSocio, string> = {
  AL_DIA: "text-green-700",
  PENDIENTE: "text-amber-700",
  VENCIDA: "text-red-700",
  SIN_CUOTA: "text-gray-600",
};

const Dato = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1">
    <dt className="text-sm text-gray-500">{label}</dt>
    <dd className="text-sm font-medium text-zinc-900">{children}</dd>
  </div>
);

/**
 * Tarjeta de socio encontrado por DNI (T-033). Presentacional: muestra los datos
 * de contacto, la membresía, el estado de cuota y el monto a cobrar. No llama a la API.
 */
export function SocioPagoCard({ socio }: { socio: SocioBusqueda }) {
  return (
    <section
      aria-label="Socio encontrado"
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <h3 className="text-base font-semibold text-zinc-900">{socio.nombre}</h3>
      <dl className="mt-2">
        <Dato label="DNI">{formatDNI(socio.dni)}</Dato>
        <Dato label="Email">{socio.email}</Dato>
        {socio.telefono && <Dato label="Teléfono">{socio.telefono}</Dato>}
        <Dato label="Membresía">
          {socio.membresia
            ? `${socio.membresia.nombre} - ${formatMoney(socio.membresia.precio)}`
            : "Sin membresía"}
        </Dato>
        <Dato label="Estado de cuota">
          <span className={ESTADO_CLASS[socio.estadoCuota]}>{ESTADO_LABEL[socio.estadoCuota]}</span>
        </Dato>
        <Dato label="Monto a cobrar">
          {socio.plan ? formatMoney(socio.oferta ? socio.oferta.montoFinal : socio.plan.monto) : "—"}
        </Dato>
        {socio.oferta && (
          <>
            <Dato label="Precio de lista">{formatMoney(socio.oferta.montoLista)}</Dato>
            <Dato label="Descuento">
              <span className="text-green-700">{`−${socio.oferta.descuentoPct} %`}</span>
            </Dato>
          </>
        )}
        {socio.plan && <Dato label="Período">{socio.plan.periodos.join(", ")}</Dato>}
      </dl>

      {!socio.membresia && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          El socio no tiene una membresía asignada: no se puede registrar un pago.
        </p>
      )}
    </section>
  );
}
