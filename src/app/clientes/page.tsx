"use client";

import React, { useState, useEffect } from "react";
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
        const [clientesData, membresasData] = await Promise.all([
          fetchClientes(),
          fetchMembresias(),
        ]);
        setClientes(clientesData);
        setMembresias(membresasData);
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

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Page title */}
      <h1 className="text-3xl font-bold">Clientes</h1>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-500">Cargando clientes...</p>
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
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Main content - two column layout */}
      {!loading && (
        <div className="flex gap-6">
          {/* Form panel - left */}
          <div className="w-96 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h2 className="font-bold text-lg">
                {selectedCliente ? "Editar Cliente" : "Nueva Cliente"}
              </h2>
            </div>
            <ClienteForm
              onSave={handleSave}
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
          </div>

          {/* List panel - right */}
          <div className="flex-1 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h2 className="font-bold text-lg">Clientes Disponibles</h2>
            </div>
            <ClienteList
              clientes={clientes}
              onModify={handleModify}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientesPage;
