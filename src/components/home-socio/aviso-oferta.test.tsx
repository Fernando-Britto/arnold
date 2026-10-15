/**
 * AvisoOfertaReactivacion (T-045d): aviso de la oferta en Home_Socio. Se muestra solo cuando
 * hay oferta (porcentaje) y no renderiza nada cuando no.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { AvisoOfertaReactivacion } from "./aviso-oferta";

describe("AvisoOfertaReactivacion", () => {
  it("muestra el aviso con el porcentaje cuando el socio es elegible", () => {
    render(<AvisoOfertaReactivacion descuentoPct={10} />);
    expect(screen.getByTestId("aviso-oferta-reactivacion")).toBeInTheDocument();
    expect(screen.getByText(/10 % de descuento/)).toBeInTheDocument();
  });

  it("no renderiza nada cuando no hay oferta", () => {
    const { container } = render(<AvisoOfertaReactivacion descuentoPct={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("aviso-oferta-reactivacion")).not.toBeInTheDocument();
  });
});
