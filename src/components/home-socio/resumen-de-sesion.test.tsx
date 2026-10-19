/**
 * Resumen al terminar la sesión (T-046b, D-62): una tarjeta por ejercicio con lo de hoy, cómo
 * le fue contra la última vez y la carga de la próxima sesión.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ResumenDeSesion } from "./resumen-de-sesion";
import type { ResumenEjercicioDTO, ResumenSesionDTO } from "@/api/sesiones";

const serie = (carga: number, repeticiones: number) => ({ carga, repeticiones, rir: 2 });

const press: ResumenEjercicioDTO = {
  ejercicioId: "ej-1",
  nombre: "Press banca",
  hoy: [serie(42.5, 10), serie(42.5, 10)],
  ultimaVez: { fecha: "2026-10-09T13:00:00.000Z", series: [serie(40, 10), serie(40, 10)] },
  tendencia: "subio",
  marcas: { carga: null, e1rm: null },
  proxima: { tipo: "subir", carga: 45, motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg." },
};

const sentadilla: ResumenEjercicioDTO = {
  ejercicioId: "ej-2",
  nombre: "Sentadilla",
  hoy: [serie(60, 8)],
  ultimaVez: null,
  tendencia: "primera",
  marcas: { carga: null, e1rm: null },
  proxima: { tipo: "mantener", carga: 60, motivo: "No llegaste a todas las repeticiones." },
};

const resumen = (over: Partial<ResumenSesionDTO> = {}): ResumenSesionDTO => ({
  sesionId: "s1",
  seriesHechas: 4,
  duracionMinutos: 45,
  ejercicios: [press, sentadilla],
  ...over,
});

describe("ResumenDeSesion", () => {
  it("muestra las series hechas y la duración", () => {
    render(<ResumenDeSesion resumen={resumen()} />);

    expect(screen.getByTestId("resumen-totales")).toHaveTextContent("4 series · 45 min");
  });

  it("usa el singular y omite la duración si no hay hora de fin", () => {
    render(<ResumenDeSesion resumen={resumen({ seriesHechas: 1, duracionMinutos: null })} />);

    expect(screen.getByTestId("resumen-totales")).toHaveTextContent(/^1 serie$/);
  });

  it("muestra una tarjeta por ejercicio, en orden", () => {
    render(<ResumenDeSesion resumen={resumen()} />);

    const filas = screen.getAllByTestId("resumen-ejercicio");
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByText("Press banca")).toBeInTheDocument();
    expect(within(filas[1]).getByText("Sentadilla")).toBeInTheDocument();
  });

  it("compara lo de hoy con la última vez", () => {
    render(<ResumenDeSesion resumen={resumen()} />);

    const fila = screen.getAllByTestId("resumen-ejercicio")[0];
    expect(fila).toHaveTextContent("Hoy: 2 × 10 a 42,5 kg");
    expect(fila).toHaveTextContent("Antes: 2 × 10 a 40 kg");
  });

  it("la primera vez no muestra la comparación", () => {
    render(<ResumenDeSesion resumen={resumen()} />);

    const fila = screen.getAllByTestId("resumen-ejercicio")[1];
    expect(fila).toHaveTextContent("Hoy: 1 × 8 a 60 kg");
    expect(fila).not.toHaveTextContent("Antes:");
  });

  it.each([
    ["subio", "Mejor que la última vez"],
    ["bajo", "Menos que la última vez"],
    ["igual", "Igual que la última vez"],
    ["primera", "Primera vez"],
  ] as const)("la tendencia %s dice «%s»", (tendencia, texto) => {
    render(<ResumenDeSesion resumen={resumen({ ejercicios: [{ ...press, tendencia }] })} />);

    const marca = screen.getByTestId("resumen-tendencia");
    expect(marca).toHaveAttribute("data-tendencia", tendencia);
    expect(marca).toHaveTextContent(texto);
  });

  it("muestra la carga de la próxima vez con su motivo", () => {
    render(<ResumenDeSesion resumen={resumen()} />);

    const fila = screen.getAllByTestId("resumen-ejercicio")[0];
    const linea = within(fila).getByTestId("sugerencia-progresion");
    expect(linea).toHaveAttribute("data-tipo", "subir");
    expect(linea).toHaveTextContent("Próxima vez: 45 kg");
    expect(linea).toHaveTextContent("+2,5 kg");
  });

  it("anticipa una descarga con su aviso", () => {
    const descarga = {
      tipo: "descargar" as const,
      carga: 35,
      motivo: "3 sesiones seguidas sin llegar a las repeticiones: bajá a 35 kg y volvé a subir.",
    };
    render(<ResumenDeSesion resumen={resumen({ ejercicios: [{ ...press, proxima: descarga }] })} />);

    expect(screen.getByTestId("sugerencia-progresion")).toHaveAttribute("data-tipo", "descargar");
    expect(screen.getByTestId("sugerencia-progresion")).toHaveTextContent("Próxima vez: 35 kg");
  });

  describe("marcas nuevas (T-046c, D-63)", () => {
    const conMarcas = (marcas: ResumenEjercicioDTO["marcas"]) =>
      resumen({ ejercicios: [{ ...press, marcas }] });

    it("anuncia una marca de carga con el valor anterior", () => {
      render(<ResumenDeSesion resumen={conMarcas({ carga: { valor: 45, anterior: 42.5 }, e1rm: null })} />);

      const marca = screen.getByTestId("resumen-marca");
      expect(marca).toHaveAttribute("data-marca", "carga");
      expect(marca).toHaveTextContent("Nueva marca de carga: 45 kg (antes 42,5 kg)");
    });

    it("anuncia una marca de 1RM estimado", () => {
      render(<ResumenDeSesion resumen={conMarcas({ carga: null, e1rm: { valor: 58, anterior: 55.5 } })} />);

      const marca = screen.getByTestId("resumen-marca");
      expect(marca).toHaveAttribute("data-marca", "e1rm");
      expect(marca).toHaveTextContent("Nuevo 1RM estimado: 58 kg (antes 55,5 kg)");
    });

    it("puede anunciar las dos a la vez", () => {
      render(
        <ResumenDeSesion
          resumen={conMarcas({ carga: { valor: 45, anterior: 42.5 }, e1rm: { valor: 58, anterior: 55 } })}
        />
      );

      expect(screen.getAllByTestId("resumen-marca")).toHaveLength(2);
    });

    it("con un servidor anterior que no manda marcas, igual muestra el resto", () => {
      const { marcas: _marcas, ...sinMarcas } = press;
      void _marcas;

      render(<ResumenDeSesion resumen={resumen({ ejercicios: [sinMarcas as ResumenEjercicioDTO] })} />);

      expect(screen.getByText("Press banca")).toBeInTheDocument();
      expect(screen.queryByTestId("resumen-marca")).not.toBeInTheDocument();
    });

    it("sin marcas no muestra nada", () => {
      render(<ResumenDeSesion resumen={resumen()} />);

      expect(screen.queryByTestId("resumen-marca")).not.toBeInTheDocument();
    });
  });

  it("no esconde un drop set de hoy bajo el '3 × 10' de las demás series", () => {
    const conDrop: ResumenEjercicioDTO = {
      ...press,
      hoy: [serie(40, 10), serie(40, 10), { ...serie(30, 6), tipo: "DROP_SET" }],
    };
    render(<ResumenDeSesion resumen={resumen({ ejercicios: [conDrop] })} />);

    expect(screen.getByTestId("resumen-ejercicio")).toHaveTextContent(
      "Hoy: 40 kg × 10, 40 kg × 10, 30 kg × 6 (drop set)"
    );
  });
});

