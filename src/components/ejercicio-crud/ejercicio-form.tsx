import React, { useState, useEffect } from "react";
import { Ejercicio } from "@prisma/client";

const GRUPO_MUSCULAR_OPTIONS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Brazos",
  "Abdomen",
];

export interface EjercicioFormProps {
  onSave: (data: {
    id?: string;
    nombre: string;
    grupoMuscular: string;
    descripcion: string;
  }) => Promise<void> | void;
  initialData: Ejercicio | null;
  isLoading?: boolean;
}

interface FormState {
  id?: string;
  nombre: string;
  grupoMuscular: string;
  descripcion: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export function EjercicioForm({
  onSave,
  initialData,
  isLoading = false,
}: EjercicioFormProps) {
  const [formData, setFormData] = useState<FormState>({
    id: initialData?.id || undefined,
    nombre: initialData?.nombre || "",
    grupoMuscular: initialData?.grupoMuscular || "",
    descripcion: initialData?.descripcion || "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        nombre: initialData.nombre,
        grupoMuscular: initialData.grupoMuscular,
        descripcion: initialData.descripcion || "",
      });
      setErrors({});
    }
  }, [initialData?.id]);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate nombre
    const trimmedNombre = formData.nombre.trim();
    if (!trimmedNombre) {
      newErrors.nombre = "Campo requerido";
    } else if (trimmedNombre.length < 3) {
      newErrors.nombre = "Mínimo 3 caracteres";
    } else if (trimmedNombre.length > 100) {
      newErrors.nombre = "Máximo 100 caracteres";
    }

    // Validate grupoMuscular
    if (!formData.grupoMuscular) {
      newErrors.grupoMuscular = "Campo requerido";
    }

    // Validate descripcion
    if (formData.descripcion && formData.descripcion.length > 500) {
      newErrors.descripcion = "Máximo 500 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (
    field: keyof FormState,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field on change
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleBlur = (field: keyof FormState) => {
    // Quick validation on blur for immediate feedback
    const newErrors = { ...errors };
    const value = formData[field];

    if (field === "nombre") {
      const trimmed = (value as string).trim();
      if (!trimmed) {
        newErrors.nombre = "Campo requerido";
      } else if (trimmed.length < 3) {
        newErrors.nombre = "Mínimo 3 caracteres";
      } else if (trimmed.length > 100) {
        newErrors.nombre = "Máximo 100 caracteres";
      } else {
        delete newErrors.nombre;
      }
    } else if (field === "grupoMuscular") {
      if (!value) {
        newErrors.grupoMuscular = "Campo requerido";
      } else {
        delete newErrors.grupoMuscular;
      }
    } else if (field === "descripcion") {
      if (value && (value as string).length > 500) {
        newErrors.descripcion = "Máximo 500 caracteres";
      } else {
        delete newErrors.descripcion;
      }
    }

    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: formData.id,
        nombre: formData.nombre.trim(),
        grupoMuscular: formData.grupoMuscular,
        descripcion: formData.descripcion.trim(),
      });

      // Clear form if in create mode (no initialData means create)
      if (!initialData) {
        setFormData({
          nombre: "",
          grupoMuscular: "",
          descripcion: "",
        });
        setErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* ID field (read-only in edit mode) */}
      {formData.id && (
        <div>
          <label htmlFor="id" className="block text-sm font-medium">
            ID
          </label>
          <input
            id="id"
            type="text"
            disabled
            value={formData.id}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 bg-gray-100"
          />
        </div>
      )}

      {/* Nombre field */}
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          type="text"
          value={formData.nombre}
          onChange={e => handleFieldChange("nombre", e.target.value)}
          onBlur={() => handleBlur("nombre")}
          disabled={isDisabled}
          className={`mt-1 block w-full rounded border px-3 py-2 ${
            errors.nombre
              ? "border-red-500 bg-red-50"
              : "border-gray-300"
          }`}
          placeholder="Ej: Press Militar"
        />
        {errors.nombre && (
          <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
        )}
      </div>

      {/* Grupo Muscular field */}
      <div>
        <label htmlFor="grupoMuscular" className="block text-sm font-medium">
          Grupo Muscular
        </label>
        <select
          id="grupoMuscular"
          value={formData.grupoMuscular}
          onChange={e => handleFieldChange("grupoMuscular", e.target.value)}
          onBlur={() => handleBlur("grupoMuscular")}
          disabled={isDisabled}
          className={`mt-1 block w-full rounded border px-3 py-2 ${
            errors.grupoMuscular
              ? "border-red-500 bg-red-50"
              : "border-gray-300"
          }`}
        >
          <option value="">Seleccionar...</option>
          {GRUPO_MUSCULAR_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.grupoMuscular && (
          <p className="mt-1 text-sm text-red-600">{errors.grupoMuscular}</p>
        )}
      </div>

      {/* Descripción field */}
      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="descripcion"
          value={formData.descripcion}
          onChange={e => handleFieldChange("descripcion", e.target.value)}
          onBlur={() => handleBlur("descripcion")}
          disabled={isDisabled}
          className={`mt-1 block w-full rounded border px-3 py-2 ${
            errors.descripcion
              ? "border-red-500 bg-red-50"
              : "border-gray-300"
          }`}
          rows={4}
          placeholder="Descripción opcional..."
        />
        {errors.descripcion && (
          <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isDisabled}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Guardar
      </button>
    </form>
  );
}
