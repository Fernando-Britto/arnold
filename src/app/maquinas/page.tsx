"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError, handleApiError } from "@/utils/api-error";
import type { Maquina } from "@/domains/maquina/maquina";
import { MaquinaFormPanel } from "@/components/maquina-crud/maquina-form-panel";
import { MaquinaList } from "@/components/maquina-crud/maquina-list";
import { EjercicioAsignacionModal } from "@/components/maquina-crud/ejercicio-asignacion-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CrudPageLayout, ListPanelShell } from "@/components/layout/crud-page-layout";
import { CrudActions } from "@/components/layout/crud-actions";
import { ActionButton } from "@/components/layout/action-bar";
import { fetchMaquinasList, deleteMaquina } from "@/api/maquinas";
import { useModalA11y } from "@/hooks/use-modal-a11y";

export function MaquinasPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Maquina | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [asignando, setAsignando] = useState<Maquina | null>(null);
  const [ejerciciosVersion, setEjerciciosVersion] = useState(0);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const modalRef = useModalA11y<HTMLDivElement>(modalOpen, closeModal);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && user.rol !== "ADMINISTRADOR") {
      router.push("/home-socio");
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;

    const loadMaquinas = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMaquinasList();
        if (!cancelled) setMaquinas(data);
      } catch (err) {
        if (!cancelled) setError(handleApiError(err, "No se pudieron cargar las máquinas."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMaquinas();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const handleFormSuccess = (maquina: Maquina) => {
    setMaquinas((prev) => {
      const existing = prev.find((m) => m.id === maquina.id);
      return existing ? prev.map((m) => (m.id === maquina.id ? maquina : m)) : [...prev, maquina];
    });
    closeModal();
    setSelectedId(null);
  };

  const handleSelect = (maquina: Maquina) => {
    setSelectedId((prev) => (prev === maquina.id ? null : maquina.id));
  };

  const handleModify = () => {
    const maquina = maquinas.find((m) => m.id === selectedId) ?? null;
    if (maquina) {
      setEditing(maquina);
      setModalOpen(true);
    }
  };

  const handleAsignar = (maquina: Maquina) => setAsignando(maquina);

  const handleAsignacionGuardada = () => {
    setEjerciciosVersion((version) => version + 1);
    setAsignando(null);
  };

  const handleDelete = () => {
    if (selectedId) setConfirmandoBorrado(true);
  };

  const confirmarBorrado = async () => {
    if (!selectedId) return;

    try {
      setBorrando(true);
      setError(null);
      await deleteMaquina(selectedId);
      setMaquinas((prev) => prev.filter((m) => m.id !== selectedId));
      closeModal();
      setSelectedId(null);
      notify("success", "Máquina eliminada");
    } catch (err) {
      if (err instanceof ApiError && err.code === "DELETE_BLOCKED_EJERCICIOS") {
        setError(err.message);
      } else {
        setError(handleApiError(err, "No se pudo eliminar la máquina."));
      }
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  };

  const isAuthorized = isAuthenticated && user?.rol === "ADMINISTRADOR";

  if (!isAuthenticated) return null;

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-ink-muted">No tienes permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">Máquinas</h1>

      {asignando && (
        <EjercicioAsignacionModal
          open
          maquinaId={asignando.id}
          onClose={() => setAsignando(null)}
          onSaved={handleAsignacionGuardada}
        />
      )}

      <ConfirmDialog
        open={confirmandoBorrado}
        title="Eliminar máquina"
        message={`¿Está seguro que desea eliminar "${
          maquinas.find((m) => m.id === selectedId)?.nombre
        }"?`}
        confirmLabel="Eliminar"
        danger
        confirmando={borrando}
        onConfirm={confirmarBorrado}
        onCancel={() => setConfirmandoBorrado(false)}
      />

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Editar máquina" : "Nueva máquina"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div ref={modalRef} className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-lg">
            <MaquinaFormPanel
              initialData={editing}
              onSuccess={handleFormSuccess}
              onCancel={closeModal}
              isEdit={!!editing?.id}
            />
          </div>
        </div>
      )}

      <CrudPageLayout
        section="maquinas"
        breadcrumb="Máquinas"
        error={error}
        actions={
          <>
            <ActionButton icon={Plus} label="Nueva máquina" onClick={() => { setEditing(null); setModalOpen(true); }} />
            <CrudActions
              hasSelection={!!selectedId}
              onModify={handleModify}
              onDelete={handleDelete}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchLabel="Buscar máquinas"
              searchPlaceholder="Buscar por nombre..."
            />
          </>
        }
        formPanel={null}
        listPanel={
          <ListPanelShell>
            <MaquinaList
              maquinas={maquinas}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAsignar={handleAsignar}
              refreshKey={ejerciciosVersion}
              searchTerm={searchTerm}
              isLoading={loading}
            />
          </ListPanelShell>
        }
      />
    </>
  );
}

export default MaquinasPage;
