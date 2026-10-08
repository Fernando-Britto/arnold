"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClienteForm } from "@/components/cliente-crud/cliente-form";
import { ClienteList } from "@/components/cliente-crud/cliente-list";
import { useAuth } from "@/contexts/auth";
import {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  type ClienteInput,
} from "@/api/clientes";
import { fetchMembresias, type MembresiaDropdown } from "@/api/membresias";
import { Cliente } from "@/domains/cliente/cliente";
import { CrudPageLayout } from "@/components/layout/crud-page-layout";

export function ClientesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [membresias, setMembresias] = useState<MembresiaDropdown[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
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
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user) {
      loadData();
    }
  }, [isAuthenticated, user]);

  const handleSave = async (formData: {
    id?: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string;
    membresiaAsignada: string;
    estadoCuenta: "Activo" | "Inactivo" | "Bloqueado";
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
        })) as Cliente;

        // Update in list
        setClientes((prev) =>
          prev.map((c) => (c.id === formData.id ? savedCliente : c))
        );
      } else {
        // Create new
        const result = (await createCliente({
          nombre: formData.nombre,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono,
          membresiaAsignada: formData.membresiaAsignada,
          estadoCuenta: formData.estadoCuenta,
        })) as any;

        savedCliente = result.cliente;
        tempPassword = result.tempPassword;

        // Add to list
        setClientes((prev) => [...prev, savedCliente]);

        // Show tempPassword modal if present
        if (tempPassword) {
          setTempPasswordModal({ visible: true, password: tempPassword });
        }
      }

      // Reset form
      setSelectedCliente(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsSaving(false);
    }
  };

  const handleModify = (cliente: Cliente) => {
    setSelectedCliente(cliente);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteCliente(id);
      setClientes((prev) => prev.filter((c) => c.id !== id));
      if (selectedCliente?.id === id) {
        setSelectedCliente(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting cliente");
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

  // Build membership labels for ClienteList display
  const membresiaLabels = useMemo(() => {
    const map: Record<string, string> = {};
    membresias.forEach((m) => {
      map[m.id] = `${m.nombre} - $${m.precio.toFixed(2)}`;
    });
    return map;
  }, [membresias]);

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
        formPanel={
          loading ? null : (
            <ClienteForm
              onSave={handleSave}
              onCancel={() => setSelectedCliente(null)}
              initialData={
                selectedCliente
                  ? {
                      id: selectedCliente.id,
                      nombre: selectedCliente.nombre,
                      dni: selectedCliente.dni,
                      email: selectedCliente.email,
                      telefono: selectedCliente.telefono,
                      membresiaAsignada: selectedCliente.membresiaAsignada,
                      estadoCuenta: selectedCliente.estadoCuenta,
                      fechaAlta: selectedCliente.fechaAlta,
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
              onModify={handleModify}
              onDelete={handleDelete}
              membresiaLabels={membresiaLabels}
            />
          )
        }
      />
    </>
  );
}

export default ClientesPage;
