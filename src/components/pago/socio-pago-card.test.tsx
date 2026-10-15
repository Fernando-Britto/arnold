/**
 * SocioPagoCard (T-033/T-045d): la vista previa del cobro muestra el descuento de reactivación
 * cuando el socio tiene oferta, y el monto de lista cuando no.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { SocioPagoCard } from "./socio-pago-card";
import type { SocioBusqueda } from "@/api/socios";

const base: SocioBusqueda = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: "+54 9 11 5555 5555",
  membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
  estadoCuota: "VENCIDA",
  plan: {
    tipo: "RENOVACION",
    periodos: ["2026-11"],
    monto: 30000,
    cubreDesde: "2026-11-01T03:00:00.000Z",
    cubreHasta: "2026-11-30T02:59:59.999Z",
  },
  oferta: null,
};

describe("SocioPagoCard", () => {
  it("con oferta muestra precio de lista, porcentaje y monto final", () => {
    render(
      <SocioPagoCard
        socio={{ ...base, oferta: { montoLista: 30000, descuentoPct: 10, montoFinal: 27000 } }}
      />
    );
    expect(screen.getByText("$ 27.000")).toBeInTheDocument(); // monto a cobrar
    expect(screen.getByText("$ 30.000")).toBeInTheDocument(); // precio de lista
    expect(screen.getByText(/10 %/)).toBeInTheDocument(); // descuento
  });

  it("sin oferta muestra solo el monto del plan y ningún detalle de descuento", () => {
    render(<SocioPagoCard socio={base} />);
    expect(screen.getByText("$ 30.000")).toBeInTheDocument();
    expect(screen.queryByText("Precio de lista")).not.toBeInTheDocument();
    expect(screen.queryByText("Descuento")).not.toBeInTheDocument();
    expect(screen.queryByText(/10 %/)).not.toBeInTheDocument();
  });
});
