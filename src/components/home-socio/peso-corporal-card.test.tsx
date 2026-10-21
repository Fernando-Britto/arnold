/**
 * Tarjeta de peso corporal del Home (T-048 parte 2, D-66): peso actual, variación, meta, gráfico y
 * los dos formularios (registrar peso y fijar meta).
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PesoCorporalCard } from "./peso-corporal-card";
import { borrarPesoCorporal, fijarMetaDePesoCorporal, registrarPesoCorporal } from "@/api/peso";
import { ApiError } from "@/utils/api-error";

jest.mock("@/api/peso", () => ({
  registrarPesoCorporal: jest.fn(),
  fijarMetaDePesoCorporal: jest.fn(),
  borrarPesoCorporal: jest.fn(),
}));

const mockRegistrar = registrarPesoCorporal as jest.MockedFunction<typeof registrarPesoCorporal>;
const mockMeta = fijarMetaDePesoCorporal as jest.MockedFunction<typeof fijarMetaDePesoCorporal>;
const mockBorrar = borrarPesoCorporal as jest.MockedFunction<typeof borrarPesoCorporal>;

const mediciones = [
  { id: "m1", fecha: "2026-09-28T15:00:00.000Z", peso: 80 },
  { id: "m2", fecha: "2026-10-05T15:00:00.000Z", peso: 78.4 },
];

function renderizar(over: Partial<React.ComponentProps<typeof PesoCorporalCard>> = {}) {
  return render(
    <PesoCorporalCard mediciones={mediciones} pesoObjetivo={null} pesoInicial={null} {...over} />
  );
}

const campoPeso = () => screen.getByLabelText(/tu peso de hoy/i);
const campoMeta = () => screen.getByLabelText(/tu meta/i);

beforeEach(() => jest.clearAllMocks());

describe("PesoCorporalCard: lo que muestra", () => {
  it("el peso actual, cuánto cambió desde el pesaje anterior y el gráfico", () => {
    renderizar();

    expect(screen.getByTestId("peso-actual")).toHaveTextContent("78,4 kg");
    expect(screen.getByTestId("peso-variacion")).toHaveTextContent("bajó 1,6 kg");
    expect(screen.getByRole("img", { name: /evolución del peso/i })).toBeInTheDocument();
  });

  it("con la meta: 'Meta 77 kg · te faltan 1,4 kg'", () => {
    renderizar({ pesoObjetivo: 77, pesoInicial: 80 });

    expect(screen.getByTestId("peso-meta")).toHaveTextContent("Meta 77 kg · te faltan 1,4 kg");
  });

  it("pasarse de la meta por el lado correcto es alcanzarla, no 'te faltan'", () => {
    renderizar({ pesoObjetivo: 79, pesoInicial: 80 });

    expect(screen.getByTestId("peso-meta")).toHaveTextContent("Meta 79 kg · ¡alcanzada!");
    expect(screen.getByTestId("peso-meta")).not.toHaveTextContent(/faltan/);
  });

  it("para subir de peso, la dirección sale del peso de partida", () => {
    renderizar({ pesoObjetivo: 82, pesoInicial: 78.4 });

    expect(screen.getByTestId("peso-meta")).toHaveTextContent("Meta 82 kg · te faltan 3,6 kg");
  });

  it("sin meta no muestra la línea de la meta", () => {
    renderizar();

    expect(screen.queryByTestId("peso-meta")).not.toBeInTheDocument();
  });

  it("con un solo pesaje no hay variación pero sí peso actual", () => {
    renderizar({ mediciones: [mediciones[1]] });

    expect(screen.getByTestId("peso-actual")).toHaveTextContent("78,4 kg");
    expect(screen.queryByTestId("peso-variacion")).not.toBeInTheDocument();
  });

  it("sin pesajes invita a registrar el peso, sin gráfico, y no deja fijar una meta", () => {
    renderizar({ mediciones: [] });

    expect(screen.getByText(/todavía no registraste tu peso/i)).toBeInTheDocument();
    expect(screen.queryByTestId("peso-actual")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(campoMeta()).toBeDisabled();
    expect(screen.getByRole("button", { name: /fijar meta/i })).toBeDisabled();
    expect(screen.getByText(/registrá tu peso para poder fijar una meta/i)).toBeInTheDocument();
  });
});

describe("PesoCorporalCard: registrar el peso", () => {
  const guardado = { id: "m3", peso: 77.8, fecha: "2026-10-07T15:00:00.000Z" };

  it("manda el peso como número, actualiza la tarjeta, vacía el campo y confirma", async () => {
    mockRegistrar.mockResolvedValueOnce(guardado);
    const user = userEvent.setup();
    renderizar({ pesoObjetivo: 77, pesoInicial: 80 });

    await user.type(campoPeso(), "77,8");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(mockRegistrar).toHaveBeenCalledWith(77.8);
    expect(await screen.findByText("Peso guardado")).toBeInTheDocument();
    expect(screen.getByTestId("peso-actual")).toHaveTextContent("77,8 kg");
    expect(screen.getByTestId("peso-variacion")).toHaveTextContent("bajó 0,6 kg");
    expect(screen.getByTestId("peso-meta")).toHaveTextContent("te faltan 0,8 kg");
    expect(campoPeso()).toHaveValue("");
    expect(screen.getAllByText("7 oct").length).toBeGreaterThan(0);
  });

  it("acepta el punto decimal además de la coma, y Enter envía el formulario", async () => {
    mockRegistrar.mockResolvedValueOnce(guardado);
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "77.8{enter}");

    expect(mockRegistrar).toHaveBeenCalledWith(77.8);
  });

  it("lo que no es un número se corrige acá, sin molestar al servidor", async () => {
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "abc");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/escribí tu peso en kilos/i);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("ataja el error de tipeo típico (784 en vez de 78,4) con el rango válido", async () => {
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "784");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/entre 20 y 400 kg/i);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("un campo vacío no se envía", async () => {
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("si el servidor rechaza el peso muestra su mensaje y no toca lo que ya se veía", async () => {
    mockRegistrar.mockRejectedValueOnce(new ApiError(400, "El peso tiene que estar entre 20 y 400 kg"));
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "77");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El peso tiene que estar entre 20 y 400 kg");
    expect(screen.getByTestId("peso-actual")).toHaveTextContent("78,4 kg");
    expect(campoPeso()).toHaveValue("77");
  });

  it("sin conexión lo dice con palabras, no con un error técnico", async () => {
    mockRegistrar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "77");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no hay conexión/i);
  });

  it("dos pesajes el mismo día cuentan uno solo: queda el último, igual que en el servidor", async () => {
    mockRegistrar.mockResolvedValueOnce({ id: "m2", peso: 78, fecha: "2026-10-05T20:00:00.000Z" });
    const user = userEvent.setup();
    const { container } = renderizar();
    expect(container.querySelectorAll("circle[data-testid='punto-de-peso']")).toHaveLength(2);

    await user.type(campoPeso(), "78");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByText("Peso guardado")).toBeInTheDocument();
    expect(container.querySelectorAll("circle[data-testid='punto-de-peso']")).toHaveLength(2);
    expect(screen.getByTestId("peso-actual")).toHaveTextContent("78 kg");
    expect(screen.getByTestId("peso-variacion")).toHaveTextContent("bajó 2 kg");
  });

  it("el primer pesaje reemplaza el estado vacío por el peso y el gráfico", async () => {
    mockRegistrar.mockResolvedValueOnce(guardado);
    const user = userEvent.setup();
    renderizar({ mediciones: [] });

    await user.type(campoPeso(), "77,8");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(await screen.findByTestId("peso-actual")).toHaveTextContent("77,8 kg");
    expect(screen.queryByText(/todavía no registraste tu peso/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    // Ya hay un peso: ahora sí se puede fijar la meta.
    expect(campoMeta()).toBeEnabled();
  });

  it("mientras guarda no se puede enviar dos veces", async () => {
    let resolver: (v: typeof guardado) => void = () => {};
    mockRegistrar.mockReturnValueOnce(new Promise((res) => (resolver = res)));
    const user = userEvent.setup();
    renderizar();

    await user.type(campoPeso(), "77,8");
    await user.click(screen.getByRole("button", { name: /guardar peso/i }));

    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
    resolver(guardado);
    expect(await screen.findByText("Peso guardado")).toBeInTheDocument();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
  });
});

describe("PesoCorporalCard: la meta", () => {
  it("fija la meta con la respuesta del servidor y muestra cuánto falta", async () => {
    mockMeta.mockResolvedValueOnce({ pesoObjetivo: 77, pesoInicial: 78.4 });
    const user = userEvent.setup();
    renderizar();

    await user.type(campoMeta(), "77");
    await user.click(screen.getByRole("button", { name: /fijar meta/i }));

    expect(mockMeta).toHaveBeenCalledWith(77);
    expect(await screen.findByText("Meta guardada")).toBeInTheDocument();
    expect(screen.getByTestId("peso-meta")).toHaveTextContent("Meta 77 kg · te faltan 1,4 kg");
    expect(campoMeta()).toHaveValue("");
  });

  it("con una meta ya fijada el botón dice 'Cambiar meta' y se puede quitar", async () => {
    renderizar({ pesoObjetivo: 77, pesoInicial: 80 });

    expect(screen.getByRole("button", { name: /cambiar meta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quitar meta/i })).toBeInTheDocument();
  });

  it("sin meta no ofrece quitarla", () => {
    renderizar();

    expect(screen.queryByRole("button", { name: /quitar meta/i })).not.toBeInTheDocument();
  });

  it("quitar la meta manda null a propósito y borra la línea de la meta", async () => {
    mockMeta.mockResolvedValueOnce({ pesoObjetivo: null, pesoInicial: null });
    const user = userEvent.setup();
    renderizar({ pesoObjetivo: 77, pesoInicial: 80 });

    await user.click(screen.getByRole("button", { name: /quitar meta/i }));

    expect(mockMeta).toHaveBeenCalledWith(null);
    expect(await screen.findByText("Meta eliminada")).toBeInTheDocument();
    expect(screen.queryByTestId("peso-meta")).not.toBeInTheDocument();
  });

  it("una meta que no es un número ni se envía", async () => {
    const user = userEvent.setup();
    renderizar();

    await user.type(campoMeta(), "poco");
    await user.click(screen.getByRole("button", { name: /fijar meta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/escribí tu meta en kilos/i);
    expect(mockMeta).not.toHaveBeenCalled();
  });

  it("una meta fuera de rango tampoco se envía", async () => {
    const user = userEvent.setup();
    renderizar();

    await user.type(campoMeta(), "5");
    await user.click(screen.getByRole("button", { name: /fijar meta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/la meta tiene que estar entre 20 y 400 kg/i);
    expect(mockMeta).not.toHaveBeenCalled();
  });

  it("si el servidor rechaza la meta muestra su mensaje y conserva la anterior", async () => {
    mockMeta.mockRejectedValueOnce(new ApiError(400, "Registrá tu peso antes de fijar una meta"));
    const user = userEvent.setup();
    renderizar({ pesoObjetivo: 77, pesoInicial: 80 });

    await user.type(campoMeta(), "75");
    await user.click(screen.getByRole("button", { name: /cambiar meta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Registrá tu peso antes de fijar una meta");
    expect(screen.getByTestId("peso-meta")).toHaveTextContent("Meta 77 kg");
  });

  it("los dos formularios están separados y cada uno tiene su nombre", () => {
    renderizar();

    expect(screen.getByRole("form", { name: /registrar peso/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /meta de peso/i })).toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: /registrar peso/i })).getByLabelText(/tu peso de hoy/i)).toBeInTheDocument();
  });
});

describe("PesoCorporalCard: borrar un pesaje (P-47, D-68)", () => {
  it("muestra los pesajes recientes con su fecha y su peso", () => {
    renderizar();

    expect(screen.getByText(/pesajes recientes/i)).toBeInTheDocument();
    expect(screen.getAllByText("5 oct").length).toBeGreaterThan(0);
    expect(screen.getAllByText("28 sep").length).toBeGreaterThan(0);
  });

  it("borra al toque, sin confirmación, y actualiza el gráfico y el peso actual", async () => {
    mockBorrar.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: /borrar pesaje de 78,4 kg del 5 oct/i }));

    expect(mockBorrar).toHaveBeenCalledWith("m2");
    expect(await screen.findByText("Pesaje borrado")).toBeInTheDocument();
    expect(screen.getByTestId("peso-actual")).toHaveTextContent("80 kg");
    expect(screen.queryByText("5 oct")).not.toBeInTheDocument();
  });

  it("si el servidor falla muestra el error y conserva el pesaje", async () => {
    mockBorrar.mockRejectedValueOnce(new ApiError(404, "Pesaje no encontrado"));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: /borrar pesaje de 78,4 kg del 5 oct/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pesaje no encontrado");
    expect(screen.getAllByText("5 oct").length).toBeGreaterThan(0);
  });
});
