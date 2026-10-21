/**
 * Filas de drop set de una serie (P-46, D-69): se agregan, se editan y se quitan antes de registrar.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropsDeSerie, type DropEnEdicion } from "./drops-de-serie";

function Contenedor({ inicial = [] as DropEnEdicion[], ...resto }: { inicial?: DropEnEdicion[]; deshabilitado?: boolean }) {
  const [drops, setDrops] = React.useState(inicial);
  return (
    <DropsDeSerie
      drops={drops}
      onChange={setDrops}
      cargaBase={40}
      repeticionesBase={10}
      {...resto}
    />
  );
}

const fila = (n: number) => screen.getByRole("group", { name: `Drop ${n}` });

describe("DropsDeSerie", () => {
  it("al principio solo ofrece agregar un drop set", () => {
    render(<Contenedor />);

    expect(screen.getByRole("button", { name: /agregar drop set/i })).toBeEnabled();
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();
  });

  it("agregar un drop lo precarga con un 20 % menos de carga que la serie y las mismas repeticiones", async () => {
    const user = userEvent.setup();
    render(<Contenedor />);

    await user.click(screen.getByRole("button", { name: /agregar drop set/i }));

    expect(within(fila(1)).getByTestId("valor-carga-drop-1")).toHaveTextContent("32.5");
    expect(within(fila(1)).getByTestId("valor-repeticiones-drop-1")).toHaveTextContent("10");
  });

  it("un segundo drop parte del anterior, no de la serie", async () => {
    const user = userEvent.setup();
    render(<Contenedor />);

    await user.click(screen.getByRole("button", { name: /agregar drop set/i }));
    await user.click(screen.getByRole("button", { name: /agregar drop set/i }));

    expect(within(fila(2)).getByTestId("valor-carga-drop-2")).toHaveTextContent("25");
  });

  it("la carga y las repeticiones del drop se ajustan con los botones (disco de 2,5 kg y 1 repetición)", async () => {
    const user = userEvent.setup();
    render(<Contenedor inicial={[{ carga: 30, repeticiones: 8 }]} />);

    await user.click(screen.getByRole("button", { name: /sumar peso del drop 1/i }));
    await user.click(screen.getByRole("button", { name: /sumar repeticiones del drop 1/i }));
    await user.click(screen.getByRole("button", { name: /sumar repeticiones del drop 1/i }));

    expect(screen.getByTestId("valor-carga-drop-1")).toHaveTextContent("32.5");
    expect(screen.getByTestId("valor-repeticiones-drop-1")).toHaveTextContent("10");

    await user.click(screen.getByRole("button", { name: /restar peso del drop 1/i }));
    await user.click(screen.getByRole("button", { name: /restar repeticiones del drop 1/i }));

    expect(screen.getByTestId("valor-carga-drop-1")).toHaveTextContent("30");
    expect(screen.getByTestId("valor-repeticiones-drop-1")).toHaveTextContent("9");
  });

  it("la carga no baja de 0 ni las repeticiones de 1", async () => {
    const user = userEvent.setup();
    render(<Contenedor inicial={[{ carga: 0, repeticiones: 1 }]} />);

    await user.click(screen.getByRole("button", { name: /restar peso del drop 1/i }));
    await user.click(screen.getByRole("button", { name: /restar repeticiones del drop 1/i }));

    expect(screen.getByTestId("valor-carga-drop-1")).toHaveTextContent("0");
    expect(screen.getByTestId("valor-repeticiones-drop-1")).toHaveTextContent("1");
  });

  it("se puede quitar un drop y los demás se renumeran", async () => {
    const user = userEvent.setup();
    render(
      <Contenedor
        inicial={[
          { carga: 32.5, repeticiones: 10 },
          { carga: 25, repeticiones: 12 },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /quitar drop 1/i }));

    expect(screen.queryByRole("group", { name: "Drop 2" })).not.toBeInTheDocument();
    expect(within(fila(1)).getByTestId("valor-carga-drop-1")).toHaveTextContent("25");
  });

  it("hay un máximo de drops por serie: al llegar, no se puede agregar otro", async () => {
    const user = userEvent.setup();
    render(<Contenedor />);

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole("button", { name: /agregar drop set/i }));
    }

    expect(screen.getAllByRole("group", { name: /^drop \d$/i })).toHaveLength(5);
    expect(screen.getByRole("button", { name: /agregar drop set/i })).toBeDisabled();
    expect(screen.getByText(/hasta 5 drop sets/i)).toBeInTheDocument();
  });

  it("deshabilitado (mientras se guarda) no deja agregar, editar ni quitar", () => {
    render(<Contenedor inicial={[{ carga: 30, repeticiones: 8 }]} deshabilitado />);

    expect(screen.getByRole("button", { name: /agregar drop set/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sumar peso del drop 1/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /quitar drop 1/i })).toBeDisabled();
  });
});
