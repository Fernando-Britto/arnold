import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientesPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
import * as clientesApi from "@/api/clientes";
import * as membresasApi from "@/api/membresias";

// Mock dependencies
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();

jest.mock("@/api/clientes", () => ({
  fetchClientes: jest.fn(),
  createCliente: jest.fn(),
  updateCliente: jest.fn(),
  deleteCliente: jest.fn(),
}));

jest.mock("@/api/membresias", () => ({
  fetchMembresias: jest.fn(),
}));

import * as actual from "@/api/membresias";

const mockClientesApi = clientesApi as jest.Mocked<typeof clientesApi>;
const mockMembresasApi = membresasApi as jest.Mocked<typeof actual>;

// El console.error del form en el camino de fallo es comportamiento de la app: se captura con
// spy por test y se afirma. `restoreAllMocks` evita que el spy filtre a otros tests (el afterEach
// de setup solo limpia llamadas, no implementaciones).
afterEach(() => {
  jest.restoreAllMocks();
});

const waitForLoadingComplete = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument();
  });
};

const ana = {
  id: "cliente-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: "+54 9 1234 567890",
  membresiaAsignada: "gold-1",
  estadoCuenta: "Activa" as const,
  fechaAlta: new Date("2024-01-15"),
};
const gold = [{ id: "gold-1", nombre: "Gold", precio: 150, estado: "ACTIVA" as const }];

describe("ClientesPage — Cliente CRUD Screen + Membresía Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
      isAdmin: true,
      isStaff: true,
    });
    mockClientesApi.fetchClientes.mockResolvedValue([]);
    mockMembresasApi.fetchMembresias.mockResolvedValue([]);
  });

  describe("AC-008: Role-based access control (RN-06)", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should render page for RECEPCIONISTA role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: true,
      });
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should deny SOCIO role access (redirect to /home-socio)", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });
      render(<ClientesPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("should deny unauthenticated access (redirect to /login)", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
      render(<ClientesPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });
  });

  describe("Data Loading", () => {
    it("should fetch clientes and membresias on component mount", async () => {
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        { id: "gold-1", nombre: "Gold", precio: 150.0, estado: "ACTIVA" as const },
      ]);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(mockClientesApi.fetchClientes).toHaveBeenCalled();
      expect(mockMembresasApi.fetchMembresias).toHaveBeenCalled();
    });

    it("should handle fetch errors gracefully", async () => {
      mockClientesApi.fetchClientes.mockRejectedValue(new TypeError("Failed to fetch"));
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await waitFor(() =>
        expect(screen.getByText(/No hay conexión con el servidor/i)).toBeInTheDocument(),
      );
    });
  });

  describe("Precarga del panel (paridad con el resto de las pantallas CRUD)", () => {
    it("muestra el form completo mientras la lista sigue esperando la BD", async () => {
      let resolver: (clientes: (typeof ana)[]) => void = () => {};
      mockClientesApi.fetchClientes.mockReturnValue(
        new Promise<(typeof ana)[]>((resolve) => {
          resolver = resolve;
        }),
      );
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);

      render(<ClientesPage />);

      // Precarga: el panel del form ya está armado antes de que responda la lista.
      expect(screen.getByRole("heading", { name: "Nuevo Cliente" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Crear/i })).toBeDisabled();
      // La lista sí avisa que sigue cargando.
      expect(screen.getByText("Cargando...")).toBeInTheDocument();

      resolver([ana]);
      await waitForLoadingComplete();
      expect(await screen.findByText("Ana García")).toBeInTheDocument();
    });
  });

  describe("Table (mockup alignment)", () => {
    it("renderiza las columnas exactas y el badge de estado de cuota", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      render(<ClientesPage />);
      await waitForLoadingComplete();

      await screen.findByText("Ana García");
      const table = screen.getByRole("table", { name: "Clientes" });
      expect(within(table).getByText("ID")).toBeInTheDocument();
      expect(within(table).getByText("DNI")).toBeInTheDocument();
      expect(within(table).getByText("Membresía")).toBeInTheDocument();
      expect(within(table).getByText("Estado de cuota")).toBeInTheDocument();
      expect(within(table).getByText("Activa")).toBeInTheDocument();
    });

    it("no renderiza botones por fila", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await screen.findByText("Ana García");
      const table = screen.getByRole("table", { name: "Clientes" });
      expect(within(table).queryByRole("button", { name: /Editar|Eliminar/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Eliminar" })).toHaveLength(1);
    });
  });

  describe("Selección + Modificar + Eliminar", () => {
    it("Modificar y Eliminar están deshabilitados sin selección", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await screen.findByText("Ana García");
      expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    });

    it("click en fila + Modificar carga el cliente en el form y permite actualizar", async () => {
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      mockClientesApi.updateCliente.mockResolvedValue(ana);
      render(<ClientesPage />);
      await waitForLoadingComplete();

      await user.click(await screen.findByText("Ana García"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));

      await waitFor(() => {
        expect(screen.getAllByText(/Editar Cliente/i).length).toBeGreaterThan(0);
      });

      const emailInput = screen.getByDisplayValue("ana@example.com");
      await user.clear(emailInput);
      await user.type(emailInput, "ana.garcia@example.com");
      await user.click(screen.getByRole("button", { name: /Actualizar/i }));

      await waitFor(() =>
        expect(mockClientesApi.updateCliente).toHaveBeenCalledWith(
          "cliente-1",
          expect.objectContaining({ email: "ana.garcia@example.com" }),
        ),
      );
      expect(mockNotify).toHaveBeenCalledWith("success", "Cliente actualizado");
    });

    it("click en fila + Eliminar confirma y borra el cliente", async () => {
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      mockClientesApi.deleteCliente.mockResolvedValue(undefined);
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<ClientesPage />);
      await waitForLoadingComplete();

      await user.click(await screen.findByText("Ana García"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));

      await waitFor(() => expect(mockClientesApi.deleteCliente).toHaveBeenCalledWith("cliente-1"));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Cliente eliminado"));
      confirmSpy.mockRestore();
    });

    it("no borra si se cancela la confirmación", async () => {
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Ana García"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      expect(mockClientesApi.deleteCliente).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe("Search", () => {
    it("filtra la tabla desde la ActionBar", async () => {
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await screen.findByText("Ana García");

      await user.click(screen.getByRole("button", { name: "Buscar" }));
      await user.type(screen.getByLabelText("Buscar clientes"), "zzz");
      expect(screen.getByText(/No se encontraron clientes/i)).toBeInTheDocument();
    });
  });

  describe("CRUD Operations", () => {
    it("should create new cliente with tempPassword modal", async () => {
      const user = userEvent.setup();
      const newCliente = {
        id: "cliente-new",
        nombre: "Juan Pérez",
        dni: "35456789",
        email: "juan@example.com",
        telefono: "+54 9 2345 678901",
        membresiaAsignada: "silver-1",
        estadoCuenta: "Activa" as const,
        fechaAlta: new Date(),
      };
      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        { id: "silver-1", nombre: "Silver", precio: 100.0, estado: "ACTIVA" as const },
      ]);
      mockClientesApi.createCliente.mockResolvedValue({
        cliente: newCliente,
        tempPassword: "TempPass-ABC123",
      });

      render(<ClientesPage />);
      await waitForLoadingComplete();

      await user.type(screen.getByLabelText(/Nombre/i), "Juan Pérez");
      await user.type(screen.getByLabelText(/DNI/i), "35.456.789");
      await user.type(screen.getByLabelText(/Email/i), "juan@example.com");
      await user.type(screen.getByLabelText(/Teléfono/i), "+54 9 2345 678901");
      await user.selectOptions(screen.getByLabelText(/Membresía/i), "silver-1");
      await user.click(screen.getByRole("button", { name: /Crear/i }));

      await waitFor(() =>
        expect(mockClientesApi.createCliente).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Juan Pérez",
            dni: "35.456.789",
            email: "juan@example.com",
            telefono: "+54 9 2345 678901",
            membresiaAsignada: "silver-1",
          }),
        ),
      );

      expect(document.body.innerHTML).toContain("Contraseña Temporal");
      expect(document.body.innerHTML).toContain("TempPass-ABC123");
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Cliente creado"));
    });

    it("limpia el formulario tras crear, para que una nueva alta arranque vacía (H5)", async () => {
      const user = userEvent.setup();
      const newCliente = {
        id: "cliente-new",
        nombre: "Juan Pérez",
        dni: "35456789",
        email: "juan@example.com",
        telefono: undefined,
        membresiaAsignada: "silver-1",
        estadoCuenta: "Activa" as const,
        fechaAlta: new Date(),
      };
      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        { id: "silver-1", nombre: "Silver", precio: 100.0, estado: "ACTIVA" as const },
      ]);
      mockClientesApi.createCliente.mockResolvedValue({
        cliente: newCliente,
        tempPassword: "TempPass-ABC123",
      });

      render(<ClientesPage />);
      await waitForLoadingComplete();

      await user.type(screen.getByLabelText(/Nombre/i), "Juan Pérez");
      await user.type(screen.getByLabelText(/DNI/i), "35.456.789");
      await user.type(screen.getByLabelText(/Email/i), "juan@example.com");
      await user.selectOptions(screen.getByLabelText(/Membresía/i), "silver-1");
      await user.click(screen.getByRole("button", { name: /Crear/i }));

      await waitFor(() => expect(mockClientesApi.createCliente).toHaveBeenCalled());

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toHaveValue("");
        expect(screen.getByLabelText(/DNI/i)).toHaveValue("");
        expect(screen.getByLabelText(/Email/i)).toHaveValue("");
      });
    });
  });

  describe("P-03: si falla una de las dos cargas, la pantalla no se cae entera", () => {
    it("falla membresías: la lista de clientes se ve, hay un aviso y no se puede crear", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockRejectedValue(new Error("boom"));
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(await screen.findByText("Ana García")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/No se pudieron cargar las membresías/i);
      expect(screen.getByRole("button", { name: /Crear/i })).toBeDisabled();
    });

    it("falla clientes: se muestra el error y no hay lista", async () => {
      mockClientesApi.fetchClientes.mockRejectedValue(
        new ApiError(500, "prisma exploded", "SERVER_ERROR"),
      );
      mockMembresasApi.fetchMembresias.mockResolvedValue([]);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(await screen.findByText(/No se pudo procesar la solicitud/i)).toBeInTheDocument();
      expect(screen.queryByText(/prisma exploded/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
    });

    it("cargas correctas: sin aviso", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        { id: "gold-1", nombre: "Gold", precio: 150, estado: "ACTIVA" as const },
      ]);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      expect(await screen.findByText("Ana García")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("T-023b: mensajes de error de la API", () => {
    it("si falla el borrado muestra el mensaje del servidor y no avisa éxito", async () => {
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      mockClientesApi.deleteCliente.mockRejectedValue(
        new ApiError(400, "El cliente tiene pagos asociados"),
      );
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Ana García"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      expect(await screen.findByText("El cliente tiene pagos asociados")).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
      confirmSpy.mockRestore();
    });

    it("si la sesión venció (401) al guardar muestra el aviso de sesión", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);
      mockClientesApi.updateCliente.mockRejectedValue(
        new ApiError(401, "TOKEN_INVALID", "TOKEN_INVALID"),
      );
      render(<ClientesPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Ana García"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      await user.click(await screen.findByRole("button", { name: /Actualizar/i }));
      expect(await screen.findByText(/Tu sesión venció/i)).toBeInTheDocument();
      expect(screen.queryByText("TOKEN_INVALID")).not.toBeInTheDocument();
      // El form registra el fallo antes de que la página lo traduzca a un aviso al usuario.
      expect(errorSpy).toHaveBeenCalledWith(
        "Form submission error:",
        expect.objectContaining({ status: 401, code: "TOKEN_INVALID" }),
      );
    });
  });

  describe("P-26: el orden de hooks es estable entre renders", () => {
    it("no rompe el orden de hooks al alternar la autenticación y computa el memo", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([ana]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(gold);

      const admin = {
        user: { id: "user1", rol: "ADMINISTRADOR" },
        isAuthenticated: true,
        isAdmin: true,
        isStaff: true,
      };

      (useAuth as jest.Mock).mockReturnValue(admin);
      const { rerender } = render(<ClientesPage />);
      await waitForLoadingComplete();

      const table = screen.getByRole("table");
      expect(within(table).getByText("Gold - $ 150")).toBeInTheDocument();
      expect(within(table).queryByText("gold-1")).not.toBeInTheDocument();

      (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
      expect(() => rerender(<ClientesPage />)).not.toThrow();

      (useAuth as jest.Mock).mockReturnValue(admin);
      expect(() => rerender(<ClientesPage />)).not.toThrow();

      await waitForLoadingComplete();
      expect(within(await screen.findByRole("table")).getByText("Gold - $ 150")).toBeInTheDocument();
    });
  });

  describe("Accesibilidad del modal de contraseña temporal (Esc + focus-trap)", () => {
    const silver = [
      { id: "silver-1", nombre: "Silver", precio: 100.0, estado: "ACTIVA" as const },
    ];
    const nuevoCliente = {
      id: "cliente-new",
      nombre: "Juan Pérez",
      dni: "35456789",
      email: "juan@example.com",
      telefono: undefined,
      membresiaAsignada: "silver-1",
      estadoCuenta: "Activa" as const,
      fechaAlta: new Date(),
    };

    async function abrirModal(user: ReturnType<typeof userEvent.setup>) {
      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(silver);
      mockClientesApi.createCliente.mockResolvedValue({
        cliente: nuevoCliente,
        tempPassword: "TempPass-ABC123",
      });
      render(<ClientesPage />);
      await waitForLoadingComplete();

      await user.type(screen.getByLabelText(/Nombre/i), "Juan Pérez");
      await user.type(screen.getByLabelText(/DNI/i), "35.456.789");
      await user.type(screen.getByLabelText(/Email/i), "juan@example.com");
      await user.selectOptions(screen.getByLabelText(/Membresía/i), "silver-1");
      await user.click(screen.getByRole("button", { name: /Crear/i }));

      return screen.findByRole("dialog");
    }

    it("expone el modal como diálogo accesible (role, aria-modal y nombre)", async () => {
      const user = userEvent.setup();
      const dialog = await abrirModal(user);

      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAccessibleName(/contraseña temporal/i);
    });

    it("mueve el foco inicial a la acción primaria (Aceptar)", async () => {
      const user = userEvent.setup();
      await abrirModal(user);

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Aceptar" }));
    });

    it("mantiene el foco dentro del modal al tabular (focus-trap)", async () => {
      const user = userEvent.setup();
      await abrirModal(user);
      const aceptar = screen.getByRole("button", { name: "Aceptar" });

      await user.tab();

      expect(document.activeElement).toBe(aceptar);
    });

    it("cierra con Escape y devuelve el foco al botón que lo abrió", async () => {
      const user = userEvent.setup();
      await abrirModal(user);
      const crear = screen.getByRole("button", { name: /Crear/i });

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(crear);
    });
  });
});
