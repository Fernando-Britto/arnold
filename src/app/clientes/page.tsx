"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClienteForm } from "@/components/cliente-crud/cliente-form";
import { ClienteList } from "@/components/cliente-crud/cliente-list";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";
import {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
} from "@/api/clientes";
import { fetchMembresias, type MembresiaDropdown } from "@/api/membresias";
import { Cliente } from "@/domains/cliente/cliente";
import { CrudPageLayout } from "@/components/layout/crud-page-layout";
import { CrudActions } from "@/components/layout/crud-actions";
import { formatMoney } from "@/utils/formatting";

export function ClientesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membresias, setMembresias] = useState<MembresiaDropdown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    visible: boolean;
    password: string;
  }>({ visible: false, password: "" });

  const [membresiasError, setMembresiasError] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Only ADMINISTRADOR and RECEPCIONISTA can access this page (RN-06)
    const allowedRoles = ["ADMINISTRADOR", "RECEPCIONISTA"];
    if (user && !allowedRoles.includes(user.rol)) {
      router.push("/home-socio");
      return;
    }
  }, [isAuthenticated, user, router]);

  // Fetch clientes and membresias on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        // P-03: allSettled, no all. Si falla solo el desplegable de membresías, la lista de
        // clientes se sigue viendo (con un aviso); solo si fallan los clientes se muestra el error.
        const [clientesRes, membresiasRes] = await Promise.allSettled([
          fetchClientes(),
          fetchMembresias(),
        ]);
        if (clientesRes.status === "rejected") {
          throw clientesRes.reason;
        }
        setClientes(clientesRes.value);
        if (membresiasRes.status === "fulfilled") {
          setMembresias(membresiasRes.value);
          setMembresiasError(false);
        } else {
          setMembresias([]);
          setMembresiasError(true);
        }
      } catch (err) {
        setError(handleApiError(err, "No se pudieron cargar los clientes."));
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadData();
    }
  }, [isAuthenticated, user]);

  // Build membership labels for ClienteList display.
  // P-26: este hook va ANTES de los `return` tempranos para que el orden de hooks sea estable
  // entre renders (isAuthenticated cambia sin romper `react-hooks/rules-of-hooks`).
  const membresiaLabels = useMemo(() => {
    const map: Record<string, string> = {};
    membresias.forEach((m) => {
      map[m.id] = `${m.nombre} - ${formatMoney(m.precio)}`;
    });
    return map;
  }, [membresias]);

  const handleSave = async (formData: {
    id?: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string;
    membresiaAsignada: string;
    estadoCuenta: "Activo" | "Inactivo" | "Bloqueado";
    pin?: string;
  }) => {
    try {
      setIsSaving(true);
      setError(null);

      let savedCliente: Cliente;
      let tempPassword: string | undefined;

      if (formData.id) {
        // Update existing
        savedCliente = (await updateCliente(formData.id, {
          nombre: formData.nombre,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono,
          membresiaAsignada: formData.membresiaAsignada,
          estadoCuenta: formData.estadoCuenta,
          pin: formData.pin,
        })) as Cliente;

        // Update in list
        setClientes((prev) =>
          prev.map((c) => (c.id === formData.id ? savedCliente : c))
        );
        notify("success", "Cliente actualizado");
      } else {
        // Create new
        const result = await createCliente({
          nombre: formData.nombre,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono,
          membresiaAsignada: formData.membresiaAsignada,
          estadoCuenta: formData.estadoCuenta,
          pin: formData.pin,
        });

        savedCliente = result.cliente;
        tempPassword = result.tempPassword;

        // Add to list
        setClientes((prev) => [...prev, savedCliente]);
        notify("success", "Cliente creado");

        // Show tempPassword modal if present
        if (tempPassword) {
          setTempPasswordModal({ visible: true, password: tempPassword });
        }
      }

      // Reset form and selection
      setEditing(null);
      setSelectedId(null);
    } catch (err) {
      setError(handleApiError(err, "No se pudo guardar el cliente."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (cliente: Cliente) => {
    setSelectedId(cliente.id);
  };

  const handleModify = () => {
    const cliente = clientes.find((c) => c.id === selectedId) ?? null;
    if (cliente) setEditing(cliente);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const cliente = clientes.find((c) => c.id === selectedId);
    if (!cliente) return;
    if (typeof window !== "undefined" && !window.confirm("¿Estás seguro de que querés eliminar este cliente?")) {
      return;
    }

    try {
      setError(null);
      await deleteCliente(selectedId);
      setClientes((prev) => prev.filter((c) => c.id !== selectedId));
      if (editing?.id === selectedId) {
        setEditing(null);
      }
      setSelectedId(null);
      notify("success", "Cliente eliminado");
    } catch (err) {
      setError(handleApiError(err, "No se pudo eliminar el cliente."));
    }
  };

  // Check if user is authorized before rendering
  const isAuthorized =
    isAuthenticated &&
    user &&
    ["ADMINISTRADOR", "RECEPCIONISTA"].includes(user.rol);

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">
            No tienes permiso para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">Clientes</h1>

      {membresiasError && (
        <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No se pudieron cargar las membresías. Podés ver los clientes, pero no crear ni editar hasta que se
          recuperen. Recargá la página para reintentar.
        </div>
      )}

      {/* Temp password modal */}
      {tempPasswordModal.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h2 className="text-xl font-bold mb-4">Contraseña Temporal</h2>
            <p className="text-gray-600 mb-4">
              La contraseña temporal para el nuevo cliente es:
            </p>
            <div className="bg-gray-100 p-3 rounded border border-gray-300 mb-4 font-mono text-center">
              {tempPasswordModal.password}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Comunica esta contraseña al cliente. Deberá cambiarla en su primer login.
            </p>
            <button
              onClick={() =>
                setTempPasswordModal({ visible: false, password: "" })
              }
              className="w-full bg-[#FC4C02] text-white py-2 rounded hover:bg-[#C13D00]"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      <CrudPageLayout
        section="clientes"
        breadcrumb="Clientes"
        error={error}
        actions={
          <CrudActions
            hasSelection={!!selectedId}
            onModify={handleModify}
            onDelete={handleDelete}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchLabel="Buscar clientes"
            searchPlaceholder="Buscar por nombre, DNI o email..."
          />
        }
        formPanel={
          loading ? null : (
            <ClienteForm
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              initialData={
                editing
                  ? {
                      id: editing.id,
                      nombre: editing.nombre,
                      dni: editing.dni,
                      email: editing.email,
                      telefono: editing.telefono,
                      membresiaAsignada: editing.membresiaAsignada,
                      estadoCuenta: editing.estadoCuenta,
                      fechaAlta: editing.fechaAlta,
                    }
                  : null
              }
              availableMembresias={membresias}
              isLoading={isSaving}
            />
          )
        }
        listPanel={
          loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500">Cargando clientes...</p>
            </div>
          ) : (
            <ClienteList
              clientes={clientes}
              selectedId={selectedId}
              onSelect={handleSelect}
              searchTerm={searchTerm}
              membresiaLabels={membresiaLabels}
            />
          )
        }
      />
    </>
  );
}

export default ClientesPage;
