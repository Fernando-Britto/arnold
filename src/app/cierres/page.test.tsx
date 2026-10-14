/**
 * Pantalla "Cierre de Caja" (T-040): previsualiza los totales del turno y confirma
 * el cierre contra POST /api/cierres.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CierresPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { fetchPreviewCierre, createCierre, fetchCierres } from "@/api/cierres";

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

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

describe("CierresPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockPreview.mockResolvedValue(preview);
    mockCierres.mockResolvedValue([]);
  });

  it("renderiza el chrome compartido (TopNav + ActionBar)", async () => {
    render(<CierresPage />);
    await waitFor(() => expect(mockPreview).toHaveBeenCalled());

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });

  it("muestra la previsualización de los totales del turno", async () => {
    render(<CierresPage />);

    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );
    expect(screen.getByText("$ 1.000")).toBeInTheDocument();
    expect(screen.getByText("$ 200")).toBeInTheDocument();
    expect(mockPreview).toHaveBeenCalled();
  });

  it("confirma el cierre, avisa el total y actualiza la previsualización", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "cierre-1",
      ...preview,
      pagos: [],
    } as never);
    mockPreview.mockResolvedValueOnce(preview).mockResolvedValueOnce({
      ...preview,
      totalRecaudado: 0,
      totalEfectivo: 0,
      totalTarjeta: 0,
      cantidadOperaciones: 0,
    });

    render(<CierresPage />);
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 1.200")
    );

    await userEvent.setup().click(screen.getByRole("button", { name: /confirmar cierre/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    // CC-2: el POST cierra exactamente el rango que se previsualizó.
    expect(mockCreate).toHaveBeenCalledWith({ desde: preview.desde, hasta: preview.hasta });
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("$ 1.200"));
    await waitFor(() =>
      expect(screen.getByTestId("cierre-total")).toHaveTextContent("$ 0")
    );
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

  it("muestra un error legible si la previsualización falla", async () => {
    mockPreview.mockRejectedValueOnce(new Error("boom"));
    render(<CierresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo calcular el cierre de caja.");
  });

  it("CC-3: muestra el historial de cierres recientes (fecha, totales por método y cantidad)", async () => {
    mockCierres.mockResolvedValueOnce([
      {
        id: "c1",
        createdAt: "2026-10-11T20:00:00.000Z",
        totalRecaudado: "1200",
        totalEfectivo: "1000",
        totalTransferencia: "0",
        totalTarjeta: "200",
        cantidadOperaciones: 2,
      },
    ]);

    render(<CierresPage />);

    const historial = await screen.findByTestId("historial-cierres");
    expect(within(historial).getByText("11/10/2026")).toBeInTheDocument();
    expect(within(historial).getByText("$ 1.200")).toBeInTheDocument();
    expect(within(historial).getByText("$ 1.000")).toBeInTheDocument();
    expect(within(historial).getByText("$ 200")).toBeInTheDocument();
    expect(within(historial).getByText("2 operaciones")).toBeInTheDocument();
  });

  it("CC-3: muestra un vacío explícito cuando no hay cierres", async () => {
    render(<CierresPage />);
    expect(await screen.findByText("Sin cierres registrados.")).toBeInTheDocument();
    expect(screen.queryByTestId("historial-cierres")).not.toBeInTheDocument();
  });
});
