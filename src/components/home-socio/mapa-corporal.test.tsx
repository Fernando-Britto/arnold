/**
 * Mapa corporal (T-051 parte 2, D-107): SVG propio con cada músculo coloreado por su volumen.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MapaCorporal } from "./mapa-corporal";
import { COLORES_POR_NIVEL, REGIONES } from "@/domains/ejercicio/mapa-corporal";

const zonas = (container: HTMLElement, musculo: string) =>
  Array.from(container.querySelectorAll(`[data-musculo="${musculo}"]`));

describe("MapaCorporal", () => {
  it("es una imagen con una descripción en palabras de lo más trabajado", () => {
    render(
      <MapaCorporal
        musculos={[
          { musculo: "pecho", etiqueta: "Pecho", series: 8, intensidad: 1 },
          { musculo: "triceps", etiqueta: "Tríceps", series: 3.2, intensidad: 0.4 },
        ]}
      />
    );

    expect(screen.getByRole("img", { name: /mapa corporal/i })).toHaveAccessibleName(
      "Mapa corporal con las series por músculo. Más trabajados: Pecho 8 series, Tríceps 3,2 series."
    );
  });

  it("sin músculos trabajados lo dice", () => {
    render(<MapaCorporal musculos={[]} />);

    expect(screen.getByRole("img", { name: /mapa corporal/i })).toHaveAccessibleName(
      "Mapa corporal sin series trabajadas en este período."
    );
  });

  it("dibuja todas las zonas, rotuladas con su músculo", () => {
    const { container } = render(<MapaCorporal musculos={[]} />);

    expect(container.querySelectorAll("[data-musculo]")).toHaveLength(REGIONES.length);
    expect(zonas(container, "pecho").length).toBeGreaterThanOrEqual(2);
  });

  it("colorea cada músculo según su intensidad y deja gris lo que no se trabajó", () => {
    const { container } = render(
      <MapaCorporal
        musculos={[
          { musculo: "pecho", etiqueta: "Pecho", series: 8, intensidad: 1 },
          { musculo: "biceps", etiqueta: "Bíceps", series: 4, intensidad: 0.5 },
        ]}
      />
    );

    for (const z of zonas(container, "pecho")) {
      expect(z).toHaveAttribute("data-nivel", "5");
      expect(z).toHaveAttribute("fill", COLORES_POR_NIVEL[5]);
    }
    for (const z of zonas(container, "biceps")) {
      expect(z).toHaveAttribute("data-nivel", "3");
      expect(z).toHaveAttribute("fill", COLORES_POR_NIVEL[3]);
    }
    for (const z of zonas(container, "gemelos")) {
      expect(z).toHaveAttribute("data-nivel", "0");
      expect(z).toHaveAttribute("fill", COLORES_POR_NIVEL[0]);
    }
  });

  it("un músculo que se ve de frente y de espalda se colorea igual en las dos vistas", () => {
    const { container } = render(
      <MapaCorporal musculos={[{ musculo: "deltoides", etiqueta: "Hombros", series: 5, intensidad: 0.7 }]} />
    );

    const fills = new Set(zonas(container, "deltoides").map((z) => z.getAttribute("fill")));
    expect(zonas(container, "deltoides").length).toBeGreaterThanOrEqual(4);
    expect(fills.size).toBe(1);
  });

  it("rotula las dos vistas", () => {
    render(<MapaCorporal musculos={[]} />);

    expect(screen.getByText("Frente")).toBeInTheDocument();
    expect(screen.getByText("Espalda")).toBeInTheDocument();
  });

  it("al pasar el mouse cada zona trabajada dice cuántas series tuvo", () => {
    const { container } = render(
      <MapaCorporal musculos={[{ musculo: "pecho", etiqueta: "Pecho", series: 8, intensidad: 1 }]} />
    );

    expect(zonas(container, "pecho")[0].querySelector("title")).toHaveTextContent("Pecho · 8 series");
    expect(zonas(container, "gemelos")[0].querySelector("title")).toBeNull();
  });
});
