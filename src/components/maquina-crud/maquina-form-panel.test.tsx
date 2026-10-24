import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaquinaFormPanel } from "./maquina-form-panel";
import { useNotifications } from "@/contexts/notifications";

jest.mock("@/contexts/notifications");
jest.mock("@/lib/cache-cliente", () => ({
  CLAVES: { maquinas: "maquinas" },
  invalidarCache: jest.fn(),
}));

import { invalidarCache, CLAVES } from "@/lib/cache-cliente";

const mockNotify = jest.fn();

global.fetch = jest.fn();

const mockMaquina = {
  id: "maq-1",
  nombre: "Polea alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as const,
  estado: "DISPONIBLE" as const,
  fechaAlta: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

describe("MaquinaFormPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (useNotifications as jest.Mock).mockReturnValue({
      notify: mockNotify,
      dismiss: jest.fn(),
    });
  });

  async function fillForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Nombre/i), "Polea baja");
    await user.type(screen.getByLabelText(/Ubicación/i), "Sala principal");
  }

  it("renderiza el formulario para una máquina nueva", () => {
    render(<MaquinaFormPanel />);

    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ubicación/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de equipamiento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
  });

  describe("crear", () => {
    it("POST a /api/maquinas, invalida la caché, avisa éxito y llama onSuccess", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;
      const onSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockMaquina, id: "maq-nueva" }),
      });

      render(<MaquinaFormPanel onSuccess={onSuccess} />);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/maquinas",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("Polea baja"),
          })
        );
      });

      expect(invalidarCache).toHaveBeenCalledWith(CLAVES.maquinas);
      expect(mockNotify).toHaveBeenCalledWith("success", "Máquina creada");
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "maq-nueva" }));
    });
  });

  describe("editar", () => {
    it("PUT a /api/maquinas/:id y avisa éxito", async () => {
      const mockFetch = global.fetch as jest.Mock;
      const onSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMaquina,
      });

      render(<MaquinaFormPanel initialData={mockMaquina} isEdit onSuccess={onSuccess} />);
      await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/maquinas/${mockMaquina.id}`,
          expect.objectContaining({
            method: "PUT",
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      expect(mockNotify).toHaveBeenCalledWith("success", "Máquina actualizada");
      expect(onSuccess).toHaveBeenCalledWith(mockMaquina);
    });
  });

  describe("error de API", () => {
    it("muestra el mensaje del servidor y no llama onSuccess", async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "DUPLICATE_NOMBRE_UBICACION",
          message: "Ya existe una máquina con el mismo nombre y ubicación",
        }),
      });

      render(<MaquinaFormPanel onSuccess={onSuccess} />);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      expect(
        await screen.findByText("Ya existe una máquina con el mismo nombre y ubicación")
      ).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("un 401 muestra el aviso de sesión vencida", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: "TOKEN_INVALID", message: "TOKEN_INVALID" }),
      });

      render(<MaquinaFormPanel />);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      expect(await screen.findByText(/Tu sesión venció/i)).toBeInTheDocument();
      expect(screen.queryByText("TOKEN_INVALID")).not.toBeInTheDocument();
    });

    it("si no hay conexión avisa que no hay conexión", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("Failed to fetch"));

      render(<MaquinaFormPanel />);
      await fillForm(user);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      expect(await screen.findByText(/No hay conexión con el servidor/i)).toBeInTheDocument();
    });
  });

  describe("reentrancia", () => {
    it("dos envíos seguidos hacen una sola petición", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;
      let resolveFetch: (value: unknown) => void = () => {};

      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFetch = resolve; })
      );

      render(<MaquinaFormPanel />);
      await fillForm(user);

      const form = screen
        .getByRole("button", { name: /Guardar/i })
        .closest("form") as HTMLFormElement;

      fireEvent.submit(form);
      fireEvent.submit(form);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => ({ ...mockMaquina, id: "maq-nueva" }) });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Máquina creada"));
    });
  });

  it("llama onCancel al cancelar", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    render(<MaquinaFormPanel onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
