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
    render(<TarjetaSugerencia estado={lista()} onAceptar={jest.fn()} onEsperar={jest.fn()} />);

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
    render(<TarjetaSugerencia estado={lista()} onAceptar={jest.fn()} onEsperar={jest.fn()} />);

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

  it("sinSugerencia: mensaje neutro único y 'Volver a consultar'", async () => {
    const onConsultar = jest.fn();
    render(
      <TarjetaSugerencia
        estado={{ tipo: "lista", sugerencia: null, siguienteEnOrden: null }}
        onConsultar={onConsultar}
      />
    );

    expect(textoDeLaTarjeta()).toContain("Todavía no tenemos una sugerencia para vos.");
    await userEvent.click(screen.getByRole("button", { name: "Volver a consultar" }));
    expect(onConsultar).toHaveBeenCalledTimes(1);
  });

  it("vencida: avisa que la reserva venció y ofrece volver a consultar", async () => {
    const onConsultar = jest.fn();
    render(<TarjetaSugerencia estado={{ tipo: "vencida" }} onConsultar={onConsultar} />);

    expect(textoDeLaTarjeta()).toContain("La reserva venció. Volvemos a consultar.");
    await userEvent.click(screen.getByRole("button", { name: "Volver a consultar" }));
    expect(onConsultar).toHaveBeenCalledTimes(1);
  });

  it("error: avisa que no pudo calcular y ofrece reintentar", async () => {
    const onConsultar = jest.fn();
    render(<TarjetaSugerencia estado={{ tipo: "error" }} onConsultar={onConsultar} />);

    expect(textoDeLaTarjeta()).toContain("No pudimos calcular tu próxima máquina.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onConsultar).toHaveBeenCalledTimes(1);
  });

  it("cargando: pulso sin texto de carga y sin botones", () => {
    render(<TarjetaSugerencia estado={{ tipo: "cargando" }} />);

    expect(screen.getByTestId("seccion-cargando")).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("D-123: sin callbacks no hay botones muertos", () => {
    const { unmount } = render(<TarjetaSugerencia estado={lista({ esperaSegundos: 90 })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    render(
      <TarjetaSugerencia estado={{ tipo: "lista", sugerencia: null, siguienteEnOrden: null }} />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("D-123: cada botón aparece solo si llega su callback", () => {
    const { unmount } = render(<TarjetaSugerencia estado={lista()} onAceptar={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Ir ahora" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esperar" })).not.toBeInTheDocument();
    unmount();

    render(<TarjetaSugerencia estado={lista()} onEsperar={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Ir ahora" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esperar" })).toBeInTheDocument();
  });

  it("aceptada: confirma la reserva y ofrece empezar entrenamiento", async () => {
    const onEmpezar = jest.fn();
    render(<TarjetaSugerencia estado={{ tipo: "aceptada", sugerencia }} onEmpezar={onEmpezar} />);

    expect(textoDeLaTarjeta()).toContain("Listo, te guardamos Banco plano para Press inclinado.");
    await userEvent.click(screen.getByRole("button", { name: "Empezar entrenamiento" }));
    expect(onEmpezar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Ir ahora" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esperar" })).not.toBeInTheDocument();
  });

  it("aceptada sin callback de empezar no muestra el botón (D-123)", () => {
    render(<TarjetaSugerencia estado={{ tipo: "aceptada", sugerencia }} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("enviando: los botones de decisión quedan deshabilitados", () => {
    render(
      <TarjetaSugerencia estado={lista({ esperaSegundos: 90 })} onAceptar={jest.fn()} onEsperar={jest.fn()} enviando />
    );

    expect(screen.getByRole("button", { name: "Ir ahora" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Esperar" })).toBeDisabled();
  });
});
