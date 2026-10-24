import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaquinaForm } from "./maquina-form";
import type { Maquina } from "@/domains/maquina/maquina";
import * as maquinaModule from "@/domains/maquina/maquina";

describe("MaquinaForm", () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const mockMaquina: Maquina = {
    id: "maquina-1",
    nombre: "Polea alta",
    tipoEquipamiento: "MAQUINA_GUIADA",
    estado: "DISPONIBLE",
    ubicacion: "Sala principal",
    fechaAlta: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza nombre, ubicación, tipo y estado", () => {
    render(<MaquinaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ubicación/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de equipamiento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
  });

  it("pre-pobla los campos al editar", () => {
    render(
      <MaquinaForm
        initialData={mockMaquina}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue("Polea alta")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sala principal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Máquina guiada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Disponible")).toBeInTheDocument();
  });

  it("una fila OCUPADA deja el select sin seleccionar y muestra el aviso", () => {
    render(
      <MaquinaForm
        initialData={{ ...mockMaquina, estado: "OCUPADA" }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
    expect(estadoSelect.value).toBe("");

    const options = Array.from(estadoSelect.options).map((opt) => opt.value);
    expect(options).toEqual(["", "DISPONIBLE", "FUERA_DE_SERVICIO", "INACTIVA"]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta máquina figura como Ocupada, un estado que ya no se asigna a mano. Elegí un estado para continuar."
    );
  });

  it("guardar sin elegir estado no llama a onSave y marca error en el campo", async () => {
    const user = userEvent.setup();
    render(
      <MaquinaForm
        initialData={{ ...mockMaquina, estado: "OCUPADA" }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(screen.getByText("Elegí un estado")).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("elegir un estado y guardar llama a onSave con el estado elegido", async () => {
    const user = userEvent.setup();
    render(
      <MaquinaForm
        initialData={{ ...mockMaquina, estado: "OCUPADA" }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    await user.selectOptions(screen.getByLabelText(/Estado/i), "DISPONIBLE");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        nombre: "Polea alta",
        ubicacion: "Sala principal",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      });
    });
  });

  it("una fila con estado asignable conserva su valor al abrir", () => {
    render(
      <MaquinaForm
        initialData={{ ...mockMaquina, estado: "FUERA_DE_SERVICIO" }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
    expect(estadoSelect.value).toBe("FUERA_DE_SERVICIO");

    const options = Array.from(estadoSelect.options).map((opt) => opt.value);
    expect(options).toEqual(["DISPONIBLE", "FUERA_DE_SERVICIO", "INACTIVA"]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un error sin campo conocido se muestra en la alerta y no llama a onSave", async () => {
    const user = userEvent.setup();
    const spy = jest
      .spyOn(maquinaModule, "validateMaquina")
      .mockReturnValue({ valid: false, errors: ["Algo raro pasó"] });

    render(<MaquinaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/Nombre/i), "Polea baja");
    await user.type(screen.getByLabelText(/Ubicación/i), "Sala principal");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo guardar: Algo raro pasó"
      );
    });
    expect(mockOnSave).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("rechaza nombre demasiado corto, bloquea onSave y muestra el error", async () => {
    const user = userEvent.setup();
    render(<MaquinaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/Nombre/i), "A");
    await user.type(screen.getByLabelText(/Ubicación/i), "Sala principal");
    await user.selectOptions(screen.getByLabelText(/Tipo de equipamiento/i), "MAQUINA_GUIADA");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(screen.getByText("El nombre debe tener entre 2 y 80 caracteres")).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("envía los valores normalizados al guardar", async () => {
    const user = userEvent.setup();
    render(<MaquinaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/Nombre/i), "  Polea   baja  ");
    await user.type(screen.getByLabelText(/Ubicación/i), " Sala   principal ");
    await user.selectOptions(screen.getByLabelText(/Tipo de equipamiento/i), "PESO_LIBRE");
    await user.selectOptions(screen.getByLabelText(/Estado/i), "FUERA_DE_SERVICIO");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        nombre: "Polea baja",
        ubicacion: "Sala principal",
        tipoEquipamiento: "PESO_LIBRE",
        estado: "FUERA_DE_SERVICIO",
      });
    });
  });

  it("llama a onCancel al hacer clic en Cancelar", async () => {
    const user = userEvent.setup();
    render(<MaquinaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(mockOnCancel).toHaveBeenCalled();
  });
});
