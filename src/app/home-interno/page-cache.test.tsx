/**
 * Degradación parcial de Home_Interno (HI-3): ante un fallo de `/api/home-interno`
 * con un payload exitoso previo, se muestran los últimos valores conocidos con un
 * aviso de desactualización y un reintento. Sin caché, se mantiene el estado de error.
 * Spec: openspec/specs/home-interno-dashboard/spec.md §Error Handling (AGGREGATION_TIMEOUT).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeInternoPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as api from "@/api/home-interno";
import { buildHomeInternoData } from "../../../tests/fixtures/home-interno-data";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/home-interno",
}));
jest.mock("@/contexts/auth");
jest.mock("@/api/home-interno", () => ({ fetchHomeInternoData: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockFetch = api.fetchHomeInternoData as jest.MockedFunction<typeof api.fetchHomeInternoData>;

const staff = {
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol: "ADMINISTRADOR" },
};
const data = buildHomeInternoData();
const loaded = () => waitFor(() => expect(screen.getByTestId("caja-total")).toBeInTheDocument());

describe("HomeInternoPage — degradación parcial (AGGREGATION_TIMEOUT)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockAuth.mockReturnValue(staff);
  });

  it("al recargar (F5) muestra el último panel cacheado sin esperar al fetch", async () => {
    mockFetch.mockResolvedValueOnce(data);
    const { unmount } = render(<HomeInternoPage />);
    await loaded();
    unmount();

    // El fetch nuevo queda colgado: el panel tiene que salir del cache de la pestaña.
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    render(<HomeInternoPage />);

    expect(screen.getByTestId("caja-total")).toHaveTextContent("$ 350");
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("conserva los últimos valores conocidos con aviso y reintento cuando una carga posterior falla", async () => {
    mockFetch.mockResolvedValueOnce(data);
    const { unmount } = render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$ 350");
    unmount();

    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    render(<HomeInternoPage />);

    expect(await screen.findByText(/datos desactualizados/i)).toBeInTheDocument();
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$ 350");
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("el reintento vuelve a pedir el panel y limpia el aviso", async () => {
    mockFetch.mockResolvedValueOnce(data);
    const { unmount } = render(<HomeInternoPage />);
    await loaded();
    unmount();

    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    render(<HomeInternoPage />);
    await screen.findByText(/datos desactualizados/i);

    mockFetch.mockResolvedValueOnce(data);
    await userEvent.setup().click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() =>
      expect(screen.queryByText(/datos desactualizados/i)).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$ 350");
  });

  it("sin datos cacheados mantiene el estado de error actual", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));
    render(<HomeInternoPage />);

    expect(await screen.findByText("No se pudo cargar el resumen operativo")).toBeInTheDocument();
    expect(screen.queryByText(/datos desactualizados/i)).not.toBeInTheDocument();
  });
});
