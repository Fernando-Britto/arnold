import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AtribucionMedia,
  EjercicioMiniatura,
  EjercicioVideo,
  urlMiniatura,
  urlVideo,
} from "./ejercicio-media";

/** Simula `prefers-reduced-motion` (jsdom no trae matchMedia). */
function movimientoReducido(activo: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: activo && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  // @ts-expect-error: se restaura el estado original de jsdom (sin matchMedia)
  delete window.matchMedia;
});

describe("urls de la media del catálogo (D-70)", () => {
  it("el video y la miniatura viven en /ejercicios/<mediaId>", () => {
    expect(urlVideo("0001-abc")).toBe("/ejercicios/0001-abc.mp4");
    expect(urlMiniatura("0001-abc")).toBe("/ejercicios/0001-abc.jpg");
  });
});

describe("EjercicioMiniatura", () => {
  it("muestra la miniatura jpg, con carga diferida y tamaño fijo para no mover la tabla", () => {
    const { container } = render(<EjercicioMiniatura mediaId="0001-abc" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/ejercicios/0001-abc.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
    expect(img).toHaveAttribute("alt", ""); // decorativa: el nombre ya está en la fila
  });

  it("sin media muestra un recuadro vacío en lugar de una imagen rota", () => {
    const { container } = render(<EjercicioMiniatura mediaId={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("miniatura-vacia")).toBeInTheDocument();
  });

  it("si la imagen no carga (archivo faltante) cae al recuadro vacío", () => {
    const { container } = render(<EjercicioMiniatura mediaId="0001-abc" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("miniatura-vacia")).toBeInTheDocument();
  });
});

describe("EjercicioVideo", () => {
  it("reproduce el mp4 en bucle y sin sonido, con la miniatura de póster", () => {
    const { container } = render(<EjercicioVideo mediaId="0001-abc" nombre="Press banca con barra" />);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "/ejercicios/0001-abc.mp4");
    expect(video).toHaveAttribute("poster", "/ejercicios/0001-abc.jpg");
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("aria-label", "Animación del ejercicio Press banca con barra");
  });

  it("con movimiento reducido no arranca solo y muestra controles", () => {
    movimientoReducido(true);
    const { container } = render(<EjercicioVideo mediaId="0001-abc" nombre="Remo" />);
    const video = container.querySelector("video")!;
    expect(video.autoplay).toBe(false);
    expect(video.controls).toBe(true);
  });

  it("si el mp4 no carga, muestra la miniatura estática en su lugar", () => {
    const { container } = render(<EjercicioVideo mediaId="0001-abc" nombre="Remo" />);
    fireEvent.error(container.querySelector("video")!);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "/ejercicios/0001-abc.jpg");
  });

  it("sin media avisa que no hay animación, sin dejar un reproductor vacío", () => {
    const { container } = render(<EjercicioVideo mediaId={null} nombre="Ejercicio propio" />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Sin animación disponible")).toBeInTheDocument();
  });
});

describe("AtribucionMedia", () => {
  it("muestra © Gym visual con enlace seguro a su sitio (condición de uso de la media)", () => {
    render(<AtribucionMedia />);
    const enlace = screen.getByRole("link", { name: /Gym visual/ });
    expect(enlace).toHaveAttribute("href", "https://gymvisual.com/");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/©/)).toBeInTheDocument();
  });
});
