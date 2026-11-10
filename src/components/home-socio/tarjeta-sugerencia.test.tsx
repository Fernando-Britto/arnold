import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TarjetaSugerencia } from "./tarjeta-sugerencia";
import type { EstadoSugerencia } from "./use-sugerencia-asignacion";
import type { SugerenciaDTO } from "@/api/asignaciones";

const sugerencia: SugerenciaDTO = {
  asignacionId: "a-1",
  ejercicioId: "e-1",
  ejercicioNombre: "Press inclinado",
  maquinaId: "m-1",
  maquinaNombre: "Banco plano",
  esperaSegundos: 0,
  ahorroSegundos: 120,
  creadaEn: "2026-11-05T12:00:00.000Z",
  venceEn: "2026-11-05T12:15:00.000Z",
};

const lista = (over: Partial<SugerenciaDTO> = {}, siguiente = null): EstadoSugerencia => ({
  tipo: "lista",
  sugerencia: { ...sugerencia, ...over },
  siguienteEnOrden: siguiente,
});

/** Texto visible de la tarjeta, con los espacios normalizados. */
function textoDeLaTarjeta(): string {
  return screen.getByTestId("tarjeta-sugerencia").textContent!.replace(/\s+/g, " ").trim();
}

describe("TarjetaSugerencia (estados con datos)", () => {
  it("libre: espera 0 muestra 'Está libre' y nombra la máquina y el ejercicio", () => {
    render(<TarjetaSugerencia estado={lista()} />);

    expect(textoDeLaTarjeta()).toContain("Está libre");
    expect(textoDeLaTarjeta()).toContain("Andá a Banco plano y hacé Press inclinado.");
    expect(screen.getByRole("button", { name: "Ir ahora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esperar" })).toBeInTheDocument();
  });

  it("enEspera: 90 s son 2 min (redondeo hacia arriba)", () => {
    render(<TarjetaSugerencia estado={lista({ esperaSegundos: 90 })} />);

    expect(textoDeLaTarjeta()).toContain("Te toca en 2 min");
    expect(textoDeLaTarjeta()).toContain("Press inclinado en Banco plano.");
  });

  it("enEspera: 60 s son 1 min y 30 s es 'menos de 1 min'", () => {
    const { unmount } = render(<TarjetaSugerencia estado={lista({ esperaSegundos: 60 })} />);
    expect(textoDeLaTarjeta()).toContain("Te toca en 1 min");
    unmount();

    render(<TarjetaSugerencia estado={lista({ esperaSegundos: 30 })} />);
    expect(textoDeLaTarjeta()).toContain("Te toca en menos de 1 min");
  });

  it("sinReserva: informa el ejercicio por orden y no ofrece acciones", () => {
    render(
      <TarjetaSugerencia
        estado={{
          tipo: "lista",
          sugerencia: null,
          siguienteEnOrden: {
            ejercicioId: "e-2",
            ejercicioNombre: "Jalón al pecho",
            maquinaId: "m-2",
            esperaSegundos: 0,
          },
        }}
      />
    );

    expect(textoDeLaTarjeta()).toContain("Ahora no tenés una reserva.");
    expect(textoDeLaTarjeta()).toContain("Si seguís el orden de tu rutina, toca Jalón al pecho.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("accesibilidad: live region, título y botones nativos", () => {
    render(<TarjetaSugerencia estado={lista()} />);

    const tarjeta = screen.getByTestId("tarjeta-sugerencia");
    expect(tarjeta.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Tu próxima máquina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir ahora" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Esperar" })).toHaveAttribute("type", "button");
  });

  it("sin nombre de máquina usa 'tu máquina'", () => {
    render(<TarjetaSugerencia estado={lista({ maquinaNombre: null })} />);

    expect(textoDeLaTarjeta()).toContain("Andá a tu máquina y hacé Press inclinado.");
    expect(textoDeLaTarjeta()).not.toContain("null");
  });

  it("los botones llaman a sus callbacks", async () => {
    const onAceptar = jest.fn();
    const onEsperar = jest.fn();
    render(<TarjetaSugerencia estado={lista({ esperaSegundos: 90 })} onAceptar={onAceptar} onEsperar={onEsperar} />);

    await userEvent.click(screen.getByRole("button", { name: "Ir ahora" }));
    await userEvent.click(screen.getByRole("button", { name: "Esperar" }));

    expect(onAceptar).toHaveBeenCalledTimes(1);
    expect(onEsperar).toHaveBeenCalledTimes(1);
  });

  it("el estado se distingue por texto, no solo por color", () => {
    const { unmount } = render(<TarjetaSugerencia estado={lista()} />);
    const libre = textoDeLaTarjeta();
    unmount();

    render(<TarjetaSugerencia estado={lista({ esperaSegundos: 120 })} />);
    const enEspera = textoDeLaTarjeta();

    expect(libre).toContain("Está libre");
    expect(enEspera).toContain("Te toca en 2 min");
    expect(libre).not.toBe(enEspera);
  });
});
