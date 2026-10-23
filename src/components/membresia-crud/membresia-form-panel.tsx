"use client";

import React, { useRef, useState } from "react";
import { MembresiaForm } from "./membresia-form";
import type { Membresia, EstadoMembresia } from "@/domains/membresia/membresia";
import { useNotifications } from "@/contexts/notifications";
import { ApiError, handleApiError, throwIfNotOk } from "@/utils/api-error";
import { CLAVES, invalidarCache } from "@/lib/cache-cliente";

interface MembresiaFormPanelProps {
  initialData?: Membresia | null;
  onSuccess?: (membresia: Membresia) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

/**
 * P-27: forma exacta de los datos del formulario de membresía. Reemplaza `useState<any>`.
 * `confirmarDesactivacion` solo lo agrega el reintento tras el aviso AC-005.
 */
type MembresiaFormData = {
  nombre: string;
  precio: number;
  periodicidad: number;
  /** NF-14: `null` vacía la descripción; `string` la guarda. */
  descripcion: string | null;
  estado: EstadoMembresia;
  confirmarDesactivacion?: boolean;
};

export function MembresiaFormPanel({
  initialData,
  onSuccess,
  onCancel,
  isEdit = false,
}: MembresiaFormPanelProps) {
  const { notify } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivationWarning, setDeactivationWarning] = useState<{
    message: string;
    assignedCount: number;
  } | null>(null);
  const [pendingFormData, setPendingFormData] = useState<MembresiaFormData | null>(null);
  // N6: guard de reentrada. `isLoading` deshabilita el botón, pero dos submits en el mismo
  // tick se disparan antes del re-render; este ref síncrono corta el segundo y evita dos POST.
  const submittingRef = useRef(false);

  const handleSave = async (formData: MembresiaFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);

    const fallback = `No se pudo ${isEdit ? "actualizar" : "crear"} la membresía`;

    try {
      const endpoint = isEdit && initialData ? `/api/membresias/${initialData.id}` : "/api/membresias";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      await throwIfNotOk(response, fallback);
      const data = await response.json();
      invalidarCache(CLAVES.membresias, CLAVES.membresiasActivas);

      // Success: clear warning state and pending data
      setDeactivationWarning(null);
      setPendingFormData(null);
      notify("success", isEdit ? "Membresía actualizada" : "Membresía creada");
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      // Check for deactivation warning (AC-005)
      if (err instanceof ApiError && err.code === "DEACTIVATION_WARNING") {
        setPendingFormData(formData); // Save for retry with confirmation
        setDeactivationWarning({
          message: err.message,
          assignedCount: parseInt(err.message.match(/\d+/)?.[0] || "0"),
        });
        return;
      }

      setError(handleApiError(err, `${fallback}.`));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleConfirmDeactivation = async () => {
    if (pendingFormData) {
      await handleSave({
        ...pendingFormData,
        confirmarDesactivacion: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-danger-soft p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {deactivationWarning && (
        <div className="rounded-md bg-warning-soft p-4 text-sm text-warning">
          <p className="font-semibold mb-2">⚠️ Advertencia de Desactivación</p>
          <p className="mb-3">{deactivationWarning.message}</p>
          <p className="text-xs text-warning mb-3">
            Esta membresía está asignada a {deactivationWarning.assignedCount} socio(s).
            Si la desactivas, estos socios dejarán de tener acceso a este plan.
          </p>
          <button
            type="button"
            onClick={handleConfirmDeactivation}
            className="inline-block rounded bg-warning px-3 py-1 text-xs text-surface hover:opacity-90"
          >
            Entendido, desactivar de todas formas
          </button>
        </div>
      )}

      <MembresiaForm
        key={initialData?.id ?? "nueva"}
        initialData={initialData}
        onSave={handleSave}
        onCancel={onCancel || (() => {})}
        isLoading={isLoading}
      />
    </div>
  );
}
