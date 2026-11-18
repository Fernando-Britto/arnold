/**
 * Pantalla "Cierre de Caja" (T-040): resumen del turno a ancho completo, confirmación
 * explícita antes de cerrar e historial paginado con detalle por fila.
 */
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CierresPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import {
  fetchPreviewCierre,
  createCierre,
  fetchCierres,
  type CierreDeCajaResumenDTO,
  type PaginaDeCierres,
} from "@/api/cierres";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/cierres",
}));
jest.mock("@/contexts/auth");
jest.mock("@/contexts/notifications");
jest.mock("@/api/cierres", () => ({
  fetchPreviewCierre: jest.fn(),
  createCierre: jest.fn(),
  fetchCierres: jest.fn(),
}));

const mockAuth = useAuth as jest.Mock;
const mockNotify = jest.fn();
const mockPreview = fetchPreviewCierre as jest.MockedFunction<typeof fetchPreviewCierre>;
const mockCreate = createCierre as jest.MockedFunction<typeof createCierre>;
const mockCierres = fetchCierres as jest.MockedFunction<typeof fetchCierres>;

const preview = {
  totalRecaudado: 1200,
  totalEfectivo: 1000,
  totalTransferencia: 0,
  totalTarjeta: 200,
  cantidadOperaciones: 2,
  desde: "2026-10-12T03:00:00.000Z",
  hasta: "2026-10-12T15:00:00.000Z",
};

const sinOperaciones = {
  ...preview,
  totalRecaudado: 0,
  totalEfectivo: 0,
  totalTransferencia: 0,
  totalTarjeta: 0,
  cantidadOperaciones: 0,
};

const cierreHistorial: CierreDeCajaResumenDTO = {
  id: "c1",
  createdAt: "2026-10-11T20:00:00.000Z",
  totalRecaudado: "1200",
  totalEfectivo: "1000",
  totalTransferencia: "0",
  totalTarjeta: "200",
  cantidadOperaciones: 2,
  pagos: [
    {
      id: "p1",
      fechaPago: "2026-10-11T18:30:00.000Z",
      monto: "1000",
      metodoPago: "EFECTIVO",
      estado: "CONFIRMADO",
    },
    {
      id: "p2",
      fechaPago: "2026-10-11T19:15:00.000Z",
      monto: "200",
      metodoPago: "TARJETA",
      estado: "CONFIRMADO",
    },
  ],
};

const pagina = (
  items: CierreDeCajaResumenDTO[],
  total: number = items.length
): PaginaDeCierres => ({ items, total });

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

async function abrirDialogo(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: "Confirmar cierre" }));
  return screen.getByRole("dialog");
}

describe("CierresPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockPreview.mockResolvedValue(preview);
    mockCierres.mockResolvedValue(pagina([]));
  });

  it("renderiza el chrome compartido y el título visible", async () => {
    render(<CierresPage />);
    await waitFor(() => expect(mockPreview).toHaveBeenCalled());

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cierre de Caja" })).toBeInTheDocument();
  });

  it("muestra el total, la fecha del turno y el desglose del resumen", async () => {
    render(<CierresPage />);

    const resumen = await screen.findByRole("region", { name: "Cierre del turno actual" });
    await waitFor(() =>
      expect(within(resumen).getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );
    expect(within(resumen).getByText(/12\/10\/2026/)).toBeInTheDocument();
    expect(within(resumen).getByText("2 operaciones pendientes de cierre")).toBeInTheDocument();
    expect(within(resumen).getByText("Efectivo")).toBeInTheDocument();
    expect(within(resumen).getByText("$ 1.000")).toBeInTheDocument();
    expect(within(resumen).getByText("Transferencia")).toBeInTheDocument();
    expect(within(resumen).getByText("Tarjeta")).toBeInTheDocument();
    expect(within(resumen).getByText("$ 200")).toBeInTheDocument();
    expect(within(resumen).getAllByText("$ 1.200").length).toBeGreaterThanOrEqual(2);
  });

  it("abre el diálogo sin hacer POST, mostrando total, desglose y operaciones", async () => {
    const user = userEvent.setup();
    render(<CierresPage />);
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );

    const dialog = await abrirDialogo(user);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Revisá el resumen antes de cerrar el turno.")).toBeInTheDocument();
    expect(within(dialog).getByText("$ 1.200")).toBeInTheDocument();
    expect(within(dialog).getByText("Efectivo")).toBeInTheDocument();
    expect(within(dialog).getByText("$ 1.000")).toBeInTheDocument();
    expect(within(dialog).getByText("Tarjeta")).toBeInTheDocument();
    expect(within(dialog).getByText("2 operaciones incluidas")).toBeInTheDocument();
  });

  it("cancelar no hace POST y cierra el diálogo", async () => {
    const user = userEvent.setup();
    render(<CierresPage />);
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );

    const dialog = await abrirDialogo(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("confirma con el rango previsualizado, notifica y refresca el historial", async () => {
    mockCreate.mockResolvedValueOnce({ id: "cierre-1", ...preview, pagos: [] } as never);
    const user = userEvent.setup();
    render(<CierresPage />);
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );

    const dialog = await abrirDialogo(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar cierre" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({ desde: preview.desde, hasta: preview.hasta });
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("$ 1.200"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
  });

  it("evita el doble envío mientras el cierre está en curso", async () => {
    let resolver!: (value: unknown) => void;
    const pendiente = new Promise<unknown>((resolve) => {
      resolver = resolve;
    });
    mockCreate.mockReturnValueOnce(pendiente as never);

    const user = userEvent.setup();
    render(<CierresPage />);
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );

    const dialog = await abrirDialogo(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar cierre" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const cerrando = within(dialog).getByRole("button", { name: "Cerrando…" });
    expect(cerrando).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await user.click(cerrando);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver({ id: "cierre-1", ...preview, pagos: [] });
      await pendiente;
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sin operaciones informa y deshabilita la acción de cierre", async () => {
    mockPreview.mockResolvedValueOnce(sinOperaciones);
    render(<CierresPage />);

    expect(
      await screen.findByText("No hay operaciones pendientes en este turno.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cierre" })).toBeDisabled();
  });

  it("muestra un error de previsualización y permite reintentar", async () => {
    mockPreview.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<CierresPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo calcular el cierre de caja."
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it("historial: tabla con columnas y fila del cierre", async () => {
    mockCierres.mockResolvedValueOnce(pagina([cierreHistorial], 1));
    render(<CierresPage />);

    const historial = await screen.findByTestId("historial-cierres");
    await waitFor(() => expect(within(historial).getByText("11/10/2026")).toBeInTheDocument());

    for (const columna of [
      "Fecha",
      "Total",
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Operaciones",
    ]) {
      expect(within(historial).getByRole("columnheader", { name: columna })).toBeInTheDocument();
    }
    expect(within(historial).getByText("$ 1.200")).toBeInTheDocument();
    expect(within(historial).getByText("$ 1.000")).toBeInTheDocument();
    expect(within(historial).getByText("$ 200")).toBeInTheDocument();
  });

  it("historial: al seleccionar una fila muestra el detalle con sus pagos", async () => {
    mockCierres.mockResolvedValueOnce(pagina([cierreHistorial], 1));
    const user = userEvent.setup();
    render(<CierresPage />);

    const fecha = await screen.findByText("11/10/2026");
    await user.click(fecha.closest('[role="row"]') as HTMLElement);

    expect(await screen.findByText("Fecha y hora")).toBeInTheDocument();
    expect(screen.getByText("11/10/2026, 17:00")).toBeInTheDocument();
    expect(screen.getByText("2 operaciones")).toBeInTheDocument();
    expect(screen.getByText("15:30 · Efectivo")).toBeInTheDocument();
    expect(screen.getByText("16:15 · Tarjeta")).toBeInTheDocument();
    expect(screen.getAllByText("$ 1.000").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("$ 200").length).toBeGreaterThanOrEqual(2);
  });

  it("historial: sin cierres muestra un vacío explícito", async () => {
    render(<CierresPage />);

    expect(await screen.findByText("Todavía no hay cierres registrados.")).toBeInTheDocument();
  });

  it("historial: muestra el error y permite reintentar", async () => {
    mockCierres
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(pagina([cierreHistorial], 1));
    const user = userEvent.setup();
    render(<CierresPage />);

    expect(await screen.findByText("No se pudieron cargar los cierres.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByText("11/10/2026")).toBeInTheDocument());
    expect(mockCierres).toHaveBeenCalledTimes(2);
  });

  it("historial: pagina pidiendo offset 10 y conserva los datos mientras carga", async () => {
    const primeraPagina = Array.from({ length: 10 }, (_, i) => ({
      ...cierreHistorial,
      id: `c-${i}`,
    }));
    let resolver!: (value: unknown) => void;
    const pendiente = new Promise<unknown>((resolve) => {
      resolver = resolve;
    });
    mockCierres
      .mockResolvedValueOnce(pagina(primeraPagina, 15))
      .mockReturnValueOnce(pendiente as never);

    const user = userEvent.setup();
    render(<CierresPage />);

    expect(await screen.findByText("Mostrando 1–10 de 15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(mockCierres).toHaveBeenLastCalledWith({ limit: 10, offset: 10 });
    // La tabla anterior sigue visible mientras llega la próxima página.
    expect(screen.getAllByText("11/10/2026").length).toBeGreaterThan(0);

    await act(async () => {
      resolver(pagina(primeraPagina.slice(5), 15));
      await pendiente;
    });

    await waitFor(() => expect(screen.getByText("Mostrando 11–15 de 15")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("redirige a /login cuando no hay sesión", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false, isStaff: false, user: null });
    render(<CierresPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("un rol no autorizado ve Acceso Denegado y no previsualiza", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<CierresPage />);
    expect(await screen.findByText("Acceso Denegado")).toBeInTheDocument();
    expect(mockPreview).not.toHaveBeenCalled();
  });
});
