import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DispositivoListPanel } from "./dispositivo-list";
import type { DispositivoDTO } from "@/api/dispositivos";

const ultimoContacto = new Date("2026-10-01T12:00:00Z");

const dispositivos: DispositivoDTO[] = [
  {
    id: "dev-1",
    nombre: "Puerta principal",
    tipo: "PUERTA",
    estado: "ACTIVO",
    ultimoContacto,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "dev-2",
    nombre: "Tablet recepción",
    tipo: "RECEPCION",
    estado: "INACTIVO",
    ultimoContacto: null,
    createdAt: new Date("2026-01-02T00:00:00Z"),
  },
];

describe("DispositivoListPanel", () => {
  it("muestra nombre, tipo, estado y último contacto de cada dispositivo", () => {
    render(<DispositivoListPanel dispositivos={dispositivos} onDesactivar={jest.fn()} />);

    expect(screen.getByText("Puerta principal")).toBeInTheDocument();
    expect(screen.getByText("Puerta")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText(ultimoContacto.toLocaleString("es-AR"))).toBeInTheDocument();

    expect(screen.getByText("Tablet recepción")).toBeInTheDocument();
    expect(screen.getByText("Recepción")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByText("Nunca")).toBeInTheDocument();
  });

  it("sólo ofrece desactivar los dispositivos ACTIVO", () => {
    render(<DispositivoListPanel dispositivos={dispositivos} onDesactivar={jest.fn()} />);
    expect(screen.getAllByRole("button", { name: "Desactivar" })).toHaveLength(1);
  });

  it("llama a onDesactivar con el dispositivo al clickear Desactivar", async () => {
    const onDesactivar = jest.fn();
    const user = userEvent.setup();
    render(<DispositivoListPanel dispositivos={dispositivos} onDesactivar={onDesactivar} />);

    await user.click(screen.getByRole("button", { name: "Desactivar" }));

    expect(onDesactivar).toHaveBeenCalledWith(dispositivos[0]);
  });

  it("deshabilita el botón del dispositivo que se está desactivando", () => {
    render(
      <DispositivoListPanel
        dispositivos={dispositivos}
        onDesactivar={jest.fn()}
        desactivandoId="dev-1"
      />
    );
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeDisabled();
  });

  it("muestra el estado vacío sin dispositivos", () => {
    render(<DispositivoListPanel dispositivos={[]} onDesactivar={jest.fn()} />);
    expect(screen.getByText("No hay dispositivos")).toBeInTheDocument();
  });
});
