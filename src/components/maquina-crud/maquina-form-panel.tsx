"use client";

import React, { useRef, useState } from "react";
import { MaquinaForm } from "./maquina-form";
import type { Maquina, TipoEquipamiento, EstadoAsignable } from "@/domains/maquina/maquina";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError, throwIfNotOk } from "@/utils/api-error";
import { CLAVES, invalidarCache } from "@/lib/cache-cliente";

interface MaquinaFormData {
  nombre: string;
  ubicacion: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoAsignable;
}

interface MaquinaFormPanelProps {
  initialData?: Maquina | null;
  onSuccess?: (maquina: Maquina) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

export function MaquinaFormPanel({
  initialData,
  onSuccess,
  onCancel,
  isEdit = false,
}: MaquinaFormPanelProps) {
  const { notify } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard de reentrada: `isLoading` deshabilita el botón, pero dos submits en el
  // mismo tick se disparan antes del re-render; este ref síncrono corta el segundo.
  const submittingRef = useRef(false);

  const handleSave = async (formData: MaquinaFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);

    const fallback = `No se pudo ${isEdit ? "actualizar" : "crear"} la máquina`;

    try {
      const endpoint = isEdit && initialData ? `/api/maquinas/${initialData.id}` : "/api/maquinas";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      await throwIfNotOk(response, fallback);
      const data = await response.json();
      invalidarCache(CLAVES.maquinas);

      notify("success", isEdit ? "Máquina actualizada" : "Máquina creada");
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(handleApiError(err, `${fallback}.`));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-danger-soft p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <MaquinaForm
        key={initialData?.id ?? "nueva"}
        initialData={initialData}
        onSave={handleSave}
        onCancel={onCancel || (() => {})}
        isLoading={isLoading}
      />
    </div>
  );
}
