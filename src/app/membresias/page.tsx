"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError, handleApiError } from "@/utils/api-error";
import { Membresia } from "@/domains/membresia/membresia";
import { MembresiaFormPanel } from "@/components/membresia-crud/membresia-form-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MembresiaListPanel,
  type MembresiaListItem,
} from "@/components/membresia-crud/membresia-list-panel";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "@/components/layout/crud-page-layout";
import { CrudActions } from "@/components/layout/crud-actions";
import { fetchMembresiasList, deleteMembresia } from "@/api/membresias";

export function MembresiasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [membresias, setMembresias] = useState<MembresiaListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Membresia | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Only ADMINISTRADOR can access this page
    const allowedRoles = ["ADMINISTRADOR"];
    if (user && !allowedRoles.includes(user.rol)) {
      router.push("/home-socio");
      return;
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    const loadMembresias = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMembresiasList();
        if (!cancelled) setMembresias(data);
      } catch (err) {
        if (!cancelled) setError(handleApiError(err, "No se pudieron cargar las membresías."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMembresias();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const handleFormSuccess = (membresia: Membresia) => {
    setMembresias((prev) => {
      const existing = prev.find((m) => m.id === membresia.id);
      // Create/update responses carry `assignedSocioCount`; keep the current one
      // (or 0 for a brand-new membresía) so the Miembros column stays consistent.
      const next: MembresiaListItem = {
        ...membresia,
        assignedSocioCount: existing?.assignedSocioCount ?? 0,
      };
      return existing
        ? prev.map((m) => (m.id === membresia.id ? next : m))
        : [...prev, next];
    });
    setEditing(null);
    setSelectedId(null);
  };

  const handleFormCancel = () => {
    setEditing(null);
  };

  // Segundo clic sobre la misma fila la cierra: el detalle vive sólo mientras está abierta.
  const handleSelect = (membresia: Membresia) => {
    setSelectedId((prev) => (prev === membresia.id ? null : membresia.id));
  };

  const handleModify = () => {
    const membresia = membresias.find((m) => m.id === selectedId) ?? null;
    if (membresia) setEditing(membresia);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setConfirmandoBorrado(true);
  };

  const confirmarBorrado = async () => {
    if (!selectedId) return;

    try {
      setBorrando(true);
      setError(null);
      await deleteMembresia(selectedId);
      setMembresias((prev) => prev.filter((m) => m.id !== selectedId));
      if (editing?.id === selectedId) {
        setEditing(null);
      }
      setSelectedId(null);
      notify("success", "Membresía eliminada");
    } catch (err) {
      // AC-006: no se puede borrar una membresía asignada a socios.
      if (err instanceof ApiError && err.code === "DELETE_BLOCKED_ASSIGNED") {
        setError(`No se puede eliminar: ${err.message}`);
      } else {
        setError(handleApiError(err, "No se pudo eliminar la membresía."));
      }
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  };

  // Check if user is authorized before rendering
  const isAuthorized =
    isAuthenticated &&
    user &&
    ["ADMINISTRADOR"].includes(user.rol);

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-ink-muted">
            No tienes permiso para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">Membresías</h1>

      <ConfirmDialog
        open={confirmandoBorrado}
        title="Eliminar membresía"
        message={`¿Está seguro que desea eliminar "${
          membresias.find((m) => m.id === selectedId)?.nombre
        }"?`}
        confirmLabel="Eliminar"
        danger
        confirmando={borrando}
        onConfirm={confirmarBorrado}
        onCancel={() => setConfirmandoBorrado(false)}
      />

      <CrudPageLayout
        section="membresias"
        breadcrumb="Membresías"
        error={error}
        actions={
          <CrudActions
            hasSelection={!!selectedId}
            onModify={handleModify}
            onDelete={handleDelete}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchLabel="Buscar membresías"
            searchPlaceholder="Buscar por nombre..."
          />
        }
        formPanel={
          <FormPanelShell
            title={editing ? "Editar Membresía" : "Nueva Membresía"}
            titleTestId="form-title"
          >
            <MembresiaFormPanel
              initialData={editing}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              isEdit={!!editing?.id}
            />
          </FormPanelShell>
        }
        listPanel={
          <ListPanelShell>
            <MembresiaListPanel
              membresias={membresias}
              selectedId={selectedId}
              onSelect={handleSelect}
              searchTerm={searchTerm}
              isLoading={loading}
            />
          </ListPanelShell>
        }
      />
    </>
  );
}

export default MembresiasPage;
