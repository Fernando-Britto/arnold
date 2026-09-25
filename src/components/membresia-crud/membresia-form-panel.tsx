"use client";

import React, { useState } from "react";
import { MembresiaForm } from "./membresia-form";
import type { Membresia, EstadoMembresia } from "@/domains/membresia/membresia";

interface MembresiaFormPanelProps {
  initialData?: Membresia | null;
  onSuccess?: (membresia: Membresia) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

export function MembresiaFormPanel({
  initialData,
  onSuccess,
  onCancel,
  isEdit = false,
}: MembresiaFormPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivationWarning, setDeactivationWarning] = useState<{
    message: string;
    assignedCount: number;
  } | null>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  const handleSave = async (formData: {
    nombre: string;
    precio: number;
    periodicidad: number;
    descripcion?: string;
    estado: EstadoMembresia;
    confirmarDesactivacion?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isEdit && initialData ? `/api/membresias/${initialData.id}` : "/api/membresias";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for deactivation warning (AC-005)
        if (data.code === "DEACTIVATION_WARNING") {
          setPendingFormData(formData); // Save for retry with confirmation
          setDeactivationWarning({
            message: data.message,
            assignedCount: parseInt(data.message.match(/\d+/)?.[0] || "0"),
          });
          setIsLoading(false);
          return;
        }

        // Other errors
        setError(data.message || `Error al ${isEdit ? "actualizar" : "crear"} membresía`);
        setIsLoading(false);
        return;
      }

      // Success: clear warning state and pending data
      setDeactivationWarning(null);
      setPendingFormData(null);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Desconocido"}`);
    } finally {
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
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {deactivationWarning && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-2">⚠️ Advertencia de Desactivación</p>
          <p className="mb-3">{deactivationWarning.message}</p>
          <p className="text-xs text-yellow-700 mb-3">
            Esta membresía está asignada a {deactivationWarning.assignedCount} socio(s).
            Si la desactivas, estos socios dejarán de tener acceso a este plan.
          </p>
          <button
            type="button"
            onClick={handleConfirmDeactivation}
            className="inline-block px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
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
