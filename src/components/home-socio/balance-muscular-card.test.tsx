/**
 * Tarjeta "Balance muscular" (T-051 parte 2, D-107): mapa corporal, lista por músculo y filtro de período.
 */
import React from "react";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BalanceMuscularCard } from "./balance-muscular-card";
import { fetchBalanceMuscular, type BalanceMuscularDTO } from "@/api/balance-muscular";
import { ApiError } from "@/utils/api-error";

jest.mock("@/api/balance-muscular", () => ({ fetchBalanceMuscular: jest.fn() }));
const mockFetch = fetchBalanceMuscular as jest.MockedFunction<typeof fetchBalanceMuscular>;

const semana: BalanceMuscularDTO = {
  periodo: "semana",
  desde: "2026-10-09T03:00:00.000Z",
  totalSeries: 14,
  musculos: [
    { musculo: "pecho", etiqueta: "Pecho", series: 8, intensidad: 1 },
    { musculo: "triceps", etiqueta: "Tríceps", series: 3.2, intensidad: 0.4 },
    { musculo: "deltoides", etiqueta: "Hombros", series: 1.6, intensidad: 0.2 },
  ],
  sinTrabajar: ["trapecios", "gemelos"],
};
const treintaDias: BalanceMuscularDTO = {
  ...semana,
  periodo: "30d",
  totalSeries: 40,
  musculos: [{ musculo: "cuadriceps", etiqueta: "Cuádriceps", series: 12, intensidad: 1 }],
  sinTrabajar: [],
};
const vacio: BalanceMuscularDTO = {
  periodo: "semana",
  desde: "2026-10-09T03:00:00.000Z",
  totalSeries: 0,
  musculos: [],
  sinTrabajar: [],
};

// `clearAllMocks` no vacía las respuestas encoladas: un test que falla dejaría las suyas para el siguiente.
beforeEach(() => mockFetch.mockReset());

describe("BalanceMuscularCard", () => {
  it("carga la semana al abrir y muestra un aviso mientras tanto", async () => {
    let resolver: (b: BalanceMuscularDTO) => void = () => {};
    mockFetch.mockReturnValueOnce(new Promise((res) => (resolver = res)));

    render(<BalanceMuscularCard />);

    expect(screen.getByRole("status")).toHaveTextContent(/cargando/i);
    expect(mockFetch).toHaveBeenCalledWith("semana");
    await act(async () => resolver(semana));
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("resume cuántas series y cuántos músculos, y desde qué día cuenta", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    expect(await screen.findByTestId("balance-resumen")).toHaveTextContent("14 series de trabajo · 3 músculos trabajados");
    expect(screen.getByTestId("balance-desde")).toHaveTextContent("Desde el 9 oct");
  });

  it("el resumen usa el singular cuando corresponde", async () => {
    mockFetch.mockResolvedValueOnce({ ...semana, totalSeries: 1, musculos: [semana.musculos[0]] });

    render(<BalanceMuscularCard />);

    expect(await screen.findByTestId("balance-resumen")).toHaveTextContent("1 serie de trabajo · 1 músculo trabajado");
  });

  it("lista los músculos de más a menos series, con su cantidad", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    const lista = await screen.findByRole("list", { name: /series por músculo/i });
    const filas = within(lista).getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("Pecho"),
      expect.stringContaining("Tríceps"),
      expect.stringContaining("Hombros"),
    ]);
    expect(filas[0]).toHaveTextContent("8 series");
    expect(filas[1]).toHaveTextContent("3,2 series");
  });

  it("la barra de cada músculo es proporcional al más trabajado", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    const barras = await screen.findAllByTestId("balance-barra");
    expect(barras[0]).toHaveStyle({ width: "100%" });
    expect(barras[1]).toHaveStyle({ width: "40%" });
    expect(barras[2]).toHaveStyle({ width: "20%" });
  });

  it("dibuja el mapa corporal con lo trabajado", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    expect(await screen.findByRole("img", { name: /mapa corporal/i })).toHaveAccessibleName(
      expect.stringContaining("Pecho 8 series")
    );
  });

  it("dice qué músculos no se trabajaron en el período", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    expect(await screen.findByTestId("balance-sin-trabajar")).toHaveTextContent(
      "Sin trabajar en este período: Trapecios, Gemelos"
    );
  });

  it("si se trabajó todo no muestra esa línea", async () => {
    mockFetch.mockResolvedValueOnce({ ...semana, sinTrabajar: [] });

    render(<BalanceMuscularCard />);

    await screen.findByTestId("balance-resumen");
    expect(screen.queryByTestId("balance-sin-trabajar")).not.toBeInTheDocument();
  });

  it("aclara cómo cuentan los músculos que acompañan", async () => {
    mockFetch.mockResolvedValueOnce(semana);

    render(<BalanceMuscularCard />);

    expect(await screen.findByText(/cuenta 0,4 series/i)).toBeInTheDocument();
  });

  it("sin series en el período lo dice, sin mapa ni lista", async () => {
    mockFetch.mockResolvedValueOnce(vacio);

    render(<BalanceMuscularCard />);

    expect(await screen.findByText(/todavía no hay series de trabajo en este período/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /mapa corporal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /series por músculo/i })).not.toBeInTheDocument();
  });

  describe("período", () => {
    const grupo = () => screen.getByRole("group", { name: /período/i });

    it("ofrece los cuatro períodos y arranca en la semana", async () => {
      mockFetch.mockResolvedValueOnce(semana);

      render(<BalanceMuscularCard />);
      await screen.findByTestId("balance-resumen");

      const botones = within(grupo()).getAllByRole("button");
      expect(botones.map((b) => b.textContent)).toEqual(["Semana", "30 días", "90 días", "Todo"]);
      expect(within(grupo()).getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
      expect(within(grupo()).getByRole("button", { name: "Todo" })).toHaveAttribute("aria-pressed", "false");
    });

    it("al elegir otro período lo pide al servidor y muestra su resultado", async () => {
      mockFetch.mockResolvedValueOnce(semana).mockResolvedValueOnce(treintaDias);
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);
      await screen.findByTestId("balance-resumen");
      await user.click(within(grupo()).getByRole("button", { name: "30 días" }));

      expect(mockFetch).toHaveBeenLastCalledWith("30d");
      expect(await screen.findByText("Cuádriceps")).toBeInTheDocument();
      expect(screen.queryByText("Pecho")).not.toBeInTheDocument();
      expect(within(grupo()).getByRole("button", { name: "30 días" })).toHaveAttribute("aria-pressed", "true");
    });

    it("mientras llega el otro período no se queda mostrando datos de uno distinto", async () => {
      let resolver: (b: BalanceMuscularDTO) => void = () => {};
      mockFetch.mockResolvedValueOnce(semana).mockReturnValueOnce(new Promise((res) => (resolver = res)));
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);
      await screen.findByTestId("balance-resumen");
      await user.click(within(grupo()).getByRole("button", { name: "90 días" }));

      expect(screen.getByRole("status")).toHaveTextContent(/cargando/i);
      expect(screen.queryByText("Pecho")).not.toBeInTheDocument();
      await act(async () => resolver({ ...treintaDias, periodo: "90d" }));
      expect(await screen.findByText("Cuádriceps")).toBeInTheDocument();
    });

    it("una respuesta que llega tarde de un período anterior se ignora", async () => {
      let resolverSemana: (b: BalanceMuscularDTO) => void = () => {};
      let resolver90: (b: BalanceMuscularDTO) => void = () => {};
      mockFetch
        .mockReturnValueOnce(new Promise((res) => (resolverSemana = res)))
        .mockReturnValueOnce(new Promise((res) => (resolver90 = res)));
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);
      await user.click(within(grupo()).getByRole("button", { name: "90 días" }));
      await act(async () => resolver90({ ...treintaDias, periodo: "90d" }));
      await act(async () => resolverSemana(semana)); // llega después, pero era de la semana

      expect(screen.getByText("Cuádriceps")).toBeInTheDocument();
      expect(screen.queryByText("Pecho")).not.toBeInTheDocument();
    });

    it("'Todo' no muestra desde cuándo cuenta", async () => {
      mockFetch.mockResolvedValueOnce(semana).mockResolvedValueOnce({ ...semana, periodo: "todo", desde: null });
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);
      await screen.findByTestId("balance-desde");
      await user.click(within(grupo()).getByRole("button", { name: "Todo" }));

      await screen.findByTestId("balance-resumen");
      expect(screen.queryByTestId("balance-desde")).not.toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("un error 5xx muestra un texto propio, nunca el detalle del servidor, y deja reintentar", async () => {
      mockFetch.mockRejectedValueOnce(new ApiError(500, "SQL boom: connection refused"));
      mockFetch.mockResolvedValueOnce(semana);
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("No se pudo procesar la solicitud. Probá de nuevo más tarde.");
      expect(alerta).not.toHaveTextContent("SQL boom");
      await user.click(screen.getByRole("button", { name: /reintentar/i }));
      expect(await screen.findByTestId("balance-resumen")).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("un error de validación (4xx) sí muestra el mensaje del servidor", async () => {
      mockFetch.mockRejectedValueOnce(new ApiError(400, "El período tiene que ser semana, 30d, 90d o todo"));

      render(<BalanceMuscularCard />);

      expect(await screen.findByRole("alert")).toHaveTextContent("El período tiene que ser semana, 30d, 90d o todo");
    });

    it("sin conexión lo dice con palabras", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      render(<BalanceMuscularCard />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/no hay conexión/i);
    });

    it("un error no impide cambiar de período", async () => {
      mockFetch.mockRejectedValueOnce(new ApiError(500, "falló")).mockResolvedValueOnce(treintaDias);
      const user = userEvent.setup();

      render(<BalanceMuscularCard />);
      await screen.findByRole("alert");
      await user.click(screen.getByRole("button", { name: "30 días" }));

      expect(await screen.findByText("Cuádriceps")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
