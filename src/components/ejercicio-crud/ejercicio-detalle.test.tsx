import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import type { Ejercicio } from "@prisma/client";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { buildEjercicio } from "../../../tests/factories/ejercicio";
import { fetchEjercicio } from "@/api/ejercicios";
import { EjercicioDetalle } from "./ejercicio-detalle";
import { EjercicioListPanel } from "./ejercicio-list";

jest.mock("@/api/ejercicios", () => ({ fetchEjercicio: jest.fn() }));
const fetchMock = fetchEjercicio as jest.MockedFunction<typeof fetchEjercicio>;

/** Un ejercicio del catálogo tal como lo trae el listado: sin instrucciones (D-70). */
const delCatalogo = (extra: Partial<EjercicioConUso> = {}): EjercicioConUso => ({
  ...buildEjercicio({
    id: "e1",
    nombre: "Curl de bíceps con mancuernas",
    grupoMuscular: "Brazos",
    descripcion: "Ejercicio clásico de brazos",
    datasetId: "0294",
    equipamiento: "Mancuerna",
    musculoObjetivo: "Bíceps",
    musculosSecundarios: ["Antebrazos", "Braquial"],
    mediaId: "0294-NbVPDMW",
  }),
  enRutinas: 0,
  instrucciones: undefined,
  ...extra,
});
const completo = (instrucciones: string[]): Ejercicio => ({ ...delCatalogo(), instrucciones } as Ejercicio);

beforeEach(() => fetchMock.mockReset());

describe("EjercicioDetalle (T-050e4, D-70)", () => {
  it("muestra la animación, el equipamiento, el músculo principal, los secundarios y la atribución", async () => {
    fetchMock.mockResolvedValue(completo(["Paso 1"]));
    const { container } = render(<EjercicioDetalle ejercicio={delCatalogo()} />);

    expect(container.querySelector("video")).toHaveAttribute("src", "/ejercicios/0294-NbVPDMW.mp4");
    expect(screen.getByText("Mancuerna")).toBeInTheDocument();
    expect(screen.getByText("Bíceps")).toBeInTheDocument();
    expect(screen.getByText("Antebrazos, Braquial")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gym visual/i })).toBeInTheDocument();
    await screen.findByText("Paso 1");
  });

  it("pide las instrucciones al abrir un ejercicio del catálogo y las muestra numeradas", async () => {
    fetchMock.mockResolvedValue(completo(["Párate con una mancuerna.", "Flexiona los codos."]));
    render(<EjercicioDetalle ejercicio={delCatalogo()} />);

    expect(screen.getByText(/cargando instrucciones/i)).toBeInTheDocument();
    const pasos = await screen.findAllByRole("listitem");
    expect(pasos.map((p) => p.textContent)).toEqual(["Párate con una mancuerna.", "Flexiona los codos."]);
    expect(pasos[0].closest("ol")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("e1");
  });

  it("si no se pueden cargar las instrucciones lo avisa y el resto del detalle sigue visible", async () => {
    fetchMock.mockRejectedValue(new Error("sin red"));
    render(<EjercicioDetalle ejercicio={delCatalogo()} />);

    expect(await screen.findByText(/no se pudieron cargar las instrucciones/i)).toBeInTheDocument();
    expect(screen.getByText("Bíceps")).toBeInTheDocument();
    expect(screen.getByText("Ejercicio clásico de brazos")).toBeInTheDocument();
  });

  it("si el ejercicio ya trae las instrucciones no las vuelve a pedir", () => {
    render(<EjercicioDetalle ejercicio={delCatalogo({ instrucciones: ["Ya cargado"] })} />);
    expect(screen.getByText("Ya cargado")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un ejercicio cargado a mano muestra solo su descripción: sin pedidos, sin video, sin atribución", () => {
    const manual: EjercicioConUso = { ...buildEjercicio({ id: "m1", descripcion: "Lo cargué yo" }), enRutinas: 0 };
    const { container } = render(<EjercicioDetalle ejercicio={manual} />);

    expect(screen.getByText("Lo cargué yo")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByText(/gym visual/i)).toBeNull();
    expect(screen.queryByText(/instrucciones/i)).toBeNull();
  });

  it("al pasar a otro ejercicio no deja a la vista las instrucciones del anterior", async () => {
    fetchMock.mockResolvedValueOnce(completo(["Pasos del primero"]));
    const { rerender } = render(<EjercicioDetalle ejercicio={delCatalogo()} />);
    await screen.findByText("Pasos del primero");

    fetchMock.mockReturnValueOnce(new Promise(() => {})); // el segundo todavía no respondió
    rerender(<EjercicioDetalle ejercicio={delCatalogo({ id: "e2", datasetId: "0300", nombre: "Otro" })} />);

    expect(screen.queryByText("Pasos del primero")).toBeNull();
    expect(screen.getByText(/cargando instrucciones/i)).toBeInTheDocument();
  });

  it("una respuesta tardía del ejercicio anterior no pisa al actual", async () => {
    let resolverPrimero!: (e: Ejercicio) => void;
    fetchMock.mockReturnValueOnce(new Promise<Ejercicio>((r) => { resolverPrimero = r; }));
    const { rerender } = render(<EjercicioDetalle ejercicio={delCatalogo()} />);

    fetchMock.mockResolvedValueOnce(completo(["Pasos del segundo"]));
    rerender(<EjercicioDetalle ejercicio={delCatalogo({ id: "e2", datasetId: "0300" })} />);
    await screen.findByText("Pasos del segundo");

    resolverPrimero(completo(["Pasos del primero"]));
    await waitFor(() => expect(screen.queryByText("Pasos del primero")).toBeNull());
    expect(screen.getByText("Pasos del segundo")).toBeInTheDocument();
  });

  it("dentro del listado, al seleccionar una fila se abre el detalle completo", async () => {
    fetchMock.mockResolvedValue(completo(["Paso del listado"]));
    render(<EjercicioListPanel ejercicios={[delCatalogo()]} selectedId="e1" />);

    expect(await screen.findByText("Paso del listado")).toBeInTheDocument();
    expect(screen.getByText("Mancuerna", { selector: "dd, span, p, td" })).toBeInTheDocument();
  });
});
