import React, { useState, useEffect } from "react";
import { Rutina, Ejercicio } from "@prisma/client";
import {
  EjercicioEnRutinaList,
  EjercicioEnRutinaRow,
} from "./ejercicio-en-rutina-list";
import { validateRutina } from "@/domains/rutina/rutina";

const OBJETIVO_OPTIONS = [
  "Hipertrofia",
  "Fuerza",
  "Resistencia",
  "Pérdida de Peso",
  "Acondicionamiento General",
];

const NIVEL_OPTIONS = [
  { label: "Básico", value: "Básico" },
  { label: "Intermedio", value: "Intermedio" },
  { label: "Avanzado", value: "Avanzado" },
];

/**
 * Normalize nivel from Prisma (uppercase) or Spanish format to display format
 */
function normalizeNivel(nivel?: string | null): string {
  if (!nivel) return "Básico";
  const upper = nivel.toUpperCase();
  if (upper === "BASICO" || upper === "BÁSICO") return "Básico";
  if (upper === "INTERMEDIO") return "Intermedio";
  if (upper === "AVANZADO") return "Avanzado";
  return nivel;
}

export interface RutinaFormProps {
  onSave: (data: {
    id?: string;
    nombre: string;
    objetivoPrincipal: string;
    frecuenciaSemanal: number;
    duracionEstimada: number;
    nivelDeDificultad: string;
    descripcion?: string;
    ejercicios: EjercicioEnRutinaRow[];
  }) => Promise<void> | void;
  initialData: (Rutina & { ejercicios?: EjercicioEnRutinaRow[] }) | null;
  availableEjercicios: Ejercicio[];
  isLoading?: boolean;
}

interface FormState {
  id?: string;
  nombre: string;
  objetivoPrincipal: string;
  frecuenciaSemanal: number;
  duracionEstimada: number;
  nivelDeDificultad: string;
  descripcion: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export function RutinaForm({
  onSave,
  initialData,
  availableEjercicios,
  isLoading = false,
}: RutinaFormProps) {
  const [formData, setFormData] = useState<FormState>({
    id: initialData?.id || undefined,
    nombre: initialData?.nombre || "",
    objetivoPrincipal: initialData?.objetivoPrincipal || "",
    frecuenciaSemanal: initialData?.frecuenciaSemanal || 3,
    duracionEstimada: initialData?.duracionEstimada || 60,
    nivelDeDificultad: normalizeNivel(initialData?.nivelDeDificultad),
    descripcion: initialData?.descripcion || "",
  });

  const [ejercicios, setEjercicios] = useState<EjercicioEnRutinaRow[]>(
    initialData?.ejercicios || []
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form when initialData changes (or resets to null)
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        nombre: initialData.nombre,
        objetivoPrincipal: initialData.objetivoPrincipal || "",
        frecuenciaSemanal: initialData.frecuenciaSemanal,
        duracionEstimada: initialData.duracionEstimada,
        nivelDeDificultad: normalizeNivel(initialData.nivelDeDificultad),
        descripcion: initialData.descripcion || "",
      });
      setEjercicios(initialData.ejercicios || []);
      setErrors({});
    } else {
      // Reset form to defaults when initialData becomes null (switching to create mode)
      setFormData({
        id: undefined,
        nombre: "",
        objetivoPrincipal: "",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
        descripcion: "",
      });
      setEjercicios([]);
      setErrors({});
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Use domain validation for rutina fields
    const validation = validateRutina({
      nombre: formData.nombre,
      frecuenciaSemanal: formData.frecuenciaSemanal,
      duracionEstimada: formData.duracionEstimada,
      nivelDeDificultad: formData.nivelDeDificultad,
      descripcion: formData.descripcion,
      objetivoPrincipal: formData.objetivoPrincipal,
    });

    if (!validation.valid) {
      validation.errors.forEach(error => {
        // Map domain error messages to field names
        if (error.includes("nombre")) {
          newErrors.nombre = error;
        } else if (error.includes("frecuencia")) {
          newErrors.frecuenciaSemanal = error;
        } else if (error.includes("duración")) {
          newErrors.duracionEstimada = error;
        } else if (error.includes("dificultad")) {
          newErrors.nivelDeDificultad = error;
        } else if (error.includes("descripción")) {
          newErrors.descripcion = error;
        } else if (error.includes("objetivo")) {
          newErrors.objetivoPrincipal = error;
        }
      });
    }

    // Validate objetivo principal
    if (!formData.objetivoPrincipal) {
      newErrors.objetivoPrincipal = "Campo requerido";
    }

    // Validate nivel de dificultad
    if (!formData.nivelDeDificultad) {
      newErrors.nivelDeDificultad = "Campo requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (
    field: keyof FormState,
    value: string | number
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
    } else if (field === "frecuenciaSemanal") {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 7) {
        newErrors.frecuenciaSemanal = "Debe estar entre 1 y 7";
      } else {
        delete newErrors.frecuenciaSemanal;
      }
    } else if (field === "duracionEstimada") {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        newErrors.duracionEstimada = "Debe ser mayor a 0";
      } else {
        delete newErrors.duracionEstimada;
      }
    } else if (field === "descripcion") {
      if (value && (value as string).length > 500) {
        newErrors.descripcion = "Máximo 500 caracteres";
      } else {
        delete newErrors.descripcion;
      }
    } else if (field === "objetivoPrincipal") {
      if (!value) {
        newErrors.objetivoPrincipal = "Campo requerido";
      } else {
        delete newErrors.objetivoPrincipal;
      }
    } else if (field === "nivelDeDificultad") {
      if (!value) {
        newErrors.nivelDeDificultad = "Campo requerido";
      } else {
        delete newErrors.nivelDeDificultad;
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
        objetivoPrincipal: formData.objetivoPrincipal,
        frecuenciaSemanal: Number(formData.frecuenciaSemanal),
        duracionEstimada: Number(formData.duracionEstimada),
        nivelDeDificultad: formData.nivelDeDificultad,
        descripcion: formData.descripcion.trim(),
        ejercicios,
      });

      // Clear form if in create mode (no initialData means create)
      if (!initialData) {
        setFormData({
          nombre: "",
          objetivoPrincipal: "",
          frecuenciaSemanal: 3,
          duracionEstimada: 60,
          nivelDeDificultad: "Básico",
          descripcion: "",
        });
        setEjercicios([]);
        setErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4">
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
            errors.nombre ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          placeholder="Ej: Rutina Full Body"
        />
        {errors.nombre && (
          <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
        )}
      </div>

      {/* Objetivo Principal field */}
      <div>
        <label
          htmlFor="objetivoPrincipal"
          className="block text-sm font-medium"
        >
          Objetivo Principal
        </label>
        <select
          id="objetivoPrincipal"
          value={formData.objetivoPrincipal}
          onChange={e =>
            handleFieldChange("objetivoPrincipal", e.target.value)
          }
          onBlur={() => handleBlur("objetivoPrincipal")}
          disabled={isDisabled}
          className={`mt-1 block w-full rounded border px-3 py-2 ${
            errors.objetivoPrincipal
              ? "border-red-500 bg-red-50"
              : "border-gray-300"
          }`}
        >
          <option value="">Seleccionar...</option>
          {OBJETIVO_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.objetivoPrincipal && (
          <p className="mt-1 text-sm text-red-600">
            {errors.objetivoPrincipal}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Frecuencia Semanal field */}
        <div>
          <label
            htmlFor="frecuenciaSemanal"
            className="block text-sm font-medium"
          >
            Frecuencia Semanal (1-7)
          </label>
          <input
            id="frecuenciaSemanal"
            type="number"
            min="1"
            max="7"
            value={formData.frecuenciaSemanal}
            onChange={e =>
              handleFieldChange("frecuenciaSemanal", parseInt(e.target.value))
            }
            onBlur={() => handleBlur("frecuenciaSemanal")}
            disabled={isDisabled}
            className={`mt-1 block w-full rounded border px-3 py-2 ${
              errors.frecuenciaSemanal
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.frecuenciaSemanal && (
            <p className="mt-1 text-sm text-red-600">
              {errors.frecuenciaSemanal}
            </p>
          )}
        </div>

        {/* Duración Estimada field */}
        <div>
          <label
            htmlFor="duracionEstimada"
            className="block text-sm font-medium"
          >
            Duración Estimada (minutos)
          </label>
          <input
            id="duracionEstimada"
            type="number"
            min="1"
            value={formData.duracionEstimada}
            onChange={e =>
              handleFieldChange("duracionEstimada", parseInt(e.target.value))
            }
            onBlur={() => handleBlur("duracionEstimada")}
            disabled={isDisabled}
            className={`mt-1 block w-full rounded border px-3 py-2 ${
              errors.duracionEstimada
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.duracionEstimada && (
            <p className="mt-1 text-sm text-red-600">
              {errors.duracionEstimada}
            </p>
          )}
        </div>
      </div>

      {/* Nivel de Dificultad field */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Nivel de Dificultad
        </label>
        <div className="flex gap-6">
          {NIVEL_OPTIONS.map(option => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="nivelDeDificultad"
                value={option.value}
                checked={formData.nivelDeDificultad === option.value}
                onChange={e =>
                  handleFieldChange("nivelDeDificultad", e.target.value)
                }
                onBlur={() => handleBlur("nivelDeDificultad")}
                disabled={isDisabled}
                className="w-4 h-4"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.nivelDeDificultad && (
          <p className="mt-1 text-sm text-red-600">
            {errors.nivelDeDificultad}
          </p>
        )}
      </div>

      {/* Descripción field */}
      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Descripción (Opcional)
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
          rows={3}
          placeholder="Descripción adicional de la rutina..."
        />
        {errors.descripcion && (
          <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
        )}
      </div>

      {/* Ejercicios Subsection */}
      <div className="border-t pt-6">
        <EjercicioEnRutinaList
          rows={ejercicios}
          availableEjercicios={availableEjercicios}
          onRowsChange={setEjercicios}
        />
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
