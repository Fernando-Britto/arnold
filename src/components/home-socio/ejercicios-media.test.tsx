import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { EjercicioDeRutinaDTO } from "@/api/home-socio-secciones";
import { MisEjerciciosSection } from "./mis-ejercicios-section";
import { MiRutinaSection } from "./mi-rutina-section";

/** Ejercicio del catálogo (D-70) tal como llega al socio. */
const delCatalogo = (over: Partial<EjercicioDeRutinaDTO> = {}): EjercicioDeRutinaDTO => ({
  id: "e1",
  nombre: "Curl de bíceps con mancuernas",
  grupoMuscular: "Brazos",
  descripcion: null,
  series: 3,
  repeticiones: 12,
  descanso: 60,
  mejorMarca: null,
  mediaId: "0294-NbVPDMW",
  equipamiento: "Mancuerna",
  musculoObjetivo: "Bíceps",
  instrucciones: ["Párate con una mancuerna en cada mano.", "Flexiona los codos."],
  ...over,
});

const aMano = (over: Partial<EjercicioDeRutinaDTO> = {}): EjercicioDeRutinaDTO =>
  delCatalogo({ id: "m1", nombre: "Ejercicio propio", mediaId: null, equipamiento: null, musculoObjetivo: null, instrucciones: [], ...over });

describe("MisEjerciciosSection con la animación del catálogo (T-050e5b, D-70)", () => {
  it("la tarjeta muestra la animación, el músculo principal y el equipamiento", () => {
    const { container } = render(<MisEjerciciosSection ejercicios={[delCatalogo()]} />);
    const tarjeta = screen.getByTestId("ejercicio-card");

    expect(container.querySelector("video")).toHaveAttribute("src", "/ejercicios/0294-NbVPDMW.mp4");
    expect(within(tarjeta).getByText(/Bíceps/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Mancuerna/)).toBeInTheDocument();
  });

  it("las instrucciones están en un desplegable cerrado y numeradas", () => {
    const { container } = render(<MisEjerciciosSection ejercicios={[delCatalogo()]} />);
    const desplegable = container.querySelector("details")!;

    expect(desplegable).not.toHaveAttribute("open");
    expect(within(desplegable).getByText("Cómo se hace")).toBeInTheDocument();
    const pasos = within(desplegable).getAllByRole("listitem", { hidden: true });
    expect(pasos.map((p) => p.textContent)).toEqual(["Párate con una mancuerna en cada mano.", "Flexiona los codos."]);
    expect(pasos[0].closest("ol")).not.toBeNull();
  });

  it("un ejercicio cargado a mano queda como antes: sin video, sin desplegable", () => {
    const { container } = render(<MisEjerciciosSection ejercicios={[aMano({ descripcion: "Con banda" })]} />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText("Con banda")).toBeInTheDocument();
    expect(screen.queryByText(/gym visual/i)).toBeNull();
  });

  it("la atribución a Gym visual aparece una sola vez por pantalla, aunque haya varios ejercicios", () => {
    render(<MisEjerciciosSection ejercicios={[delCatalogo(), delCatalogo({ id: "e2", nombre: "Otro", mediaId: "0001-abc" })]} />);
    expect(screen.getAllByRole("link", { name: /gym visual/i })).toHaveLength(1);
  });

  it("sin ejercicios sigue mostrando el aviso y ninguna atribución", () => {
    render(<MisEjerciciosSection ejercicios={[]} />);
    expect(screen.getByText(/todavía no tenés ejercicios asignados/i)).toBeInTheDocument();
    expect(screen.queryByText(/gym visual/i)).toBeNull();
  });
});

describe("MiRutinaSection con miniaturas (T-050e5b, D-70)", () => {
  const rutina = (ejercicios: EjercicioDeRutinaDTO[]) => ({ nombre: "Fuerza A", rutinaAsignadaId: "ra1", ejercicios });

  it("muestra la miniatura de los ejercicios del catálogo y nada para los cargados a mano", () => {
    const { container } = render(
      <MiRutinaSection rutina={rutina([delCatalogo(), aMano()])} sesiones={[]} sesionEnCurso={null} />
    );
    const imagenes = container.querySelectorAll("img");
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0]).toHaveAttribute("src", "/ejercicios/0294-NbVPDMW.jpg");
  });

  it("muestra la atribución una vez cuando hay miniaturas", () => {
    render(<MiRutinaSection rutina={rutina([delCatalogo(), delCatalogo({ id: "e2" })])} sesiones={[]} sesionEnCurso={null} />);
    expect(screen.getAllByRole("link", { name: /gym visual/i })).toHaveLength(1);
  });
});
