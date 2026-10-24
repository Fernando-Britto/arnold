"use client";

import React, { useState } from "react";
import {
  validateMaquina,
  normalizeMaquina,
  ESTADOS_ASIGNABLES,
  TIPOS_EQUIPAMIENTO,
  type Maquina,
  type TipoEquipamiento,
  type EstadoAsignable,
} from "@/domains/maquina/maquina";

interface ValidationErrors {
  [key: string]: string;
}

interface MaquinaFormProps {
  initialData?: Maquina | null;
  onSave: (data: {
    nombre: string;
    ubicacion: string;
    tipoEquipamiento: TipoEquipamiento;
    estado: EstadoAsignable;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TIPO_LABEL: Record<TipoEquipamiento, string> = {
  MAQUINA_GUIADA: "Máquina guiada",
  PESO_LIBRE: "Peso libre",
  CARDIO: "Cardio",
};

const ESTADO_LABEL: Record<EstadoAsignable, string> = {
  DISPONIBLE: "Disponible",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  INACTIVA: "Inactiva",
};

export function MaquinaForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: MaquinaFormProps) {
  const estadoInicial: EstadoAsignable =
    initialData?.estado && ESTADOS_ASIGNABLES.includes(initialData.estado as EstadoAsignable)
      ? (initialData.estado as EstadoAsignable)
      : "DISPONIBLE";

  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || "",
    ubicacion: initialData?.ubicacion || "",
    tipoEquipamiento: initialData?.tipoEquipamiento || ("MAQUINA_GUIADA" as TipoEquipamiento),
    estado: estadoInicial,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateMaquina({
      nombre: formData.nombre,
      ubicacion: formData.ubicacion,
      tipoEquipamiento: formData.tipoEquipamiento,
      estado: formData.estado,
    });

    if (!validation.valid) {
      const next: ValidationErrors = {};
      validation.errors.forEach((error) => {
        if (error.includes("nombre")) next.nombre = error;
        if (error.includes("ubicación")) next.ubicacion = error;
        if (error.includes("equipamiento")) next.tipoEquipamiento = error;
        if (error.includes("estado")) next.estado = error;
      });
      setErrors(next);
      return;
    }

    onSave(
      normalizeMaquina({
        nombre: formData.nombre,
        ubicacion: formData.ubicacion,
        tipoEquipamiento: formData.tipoEquipamiento as TipoEquipamiento,
        estado: formData.estado as EstadoAsignable,
      })
    );
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand ${
      errors[field] ? "border-danger bg-danger-soft" : "border-border"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-ink-soft mb-1">
          Nombre *
        </label>
        <input
          type="text"
          id="nombre"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          maxLength={80}
          className={inputClass("nombre")}
        />
        {errors.nombre && <p className="text-danger text-sm mt-1">{errors.nombre}</p>}
      </div>

      <div>
        <label htmlFor="ubicacion" className="block text-sm font-medium text-ink-soft mb-1">
          Ubicación *
        </label>
        <input
          type="text"
          id="ubicacion"
          name="ubicacion"
          value={formData.ubicacion}
          onChange={handleChange}
          maxLength={80}
          className={inputClass("ubicacion")}
        />
        {errors.ubicacion && <p className="text-danger text-sm mt-1">{errors.ubicacion}</p>}
      </div>

      <div>
        <label htmlFor="tipoEquipamiento" className="block text-sm font-medium text-ink-soft mb-1">
          Tipo de equipamiento *
        </label>
        <select
          id="tipoEquipamiento"
          name="tipoEquipamiento"
          value={formData.tipoEquipamiento}
          onChange={handleChange}
          className={inputClass("tipoEquipamiento")}
        >
          {TIPOS_EQUIPAMIENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TIPO_LABEL[tipo]}
            </option>
          ))}
        </select>
        {errors.tipoEquipamiento && (
          <p className="text-danger text-sm mt-1">{errors.tipoEquipamiento}</p>
        )}
      </div>

      <div>
        <label htmlFor="estado" className="block text-sm font-medium text-ink-soft mb-1">
          Estado *
        </label>
        <select
          id="estado"
          name="estado"
          value={formData.estado}
          onChange={handleChange}
          className={inputClass("estado")}
        >
          {ESTADOS_ASIGNABLES.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_LABEL[estado]}
            </option>
          ))}
        </select>
        {errors.estado && <p className="text-danger text-sm mt-1">{errors.estado}</p>}
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
        >
          {isLoading ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-surface-active text-ink rounded-md hover:bg-surface-active disabled:bg-surface-subtle disabled:cursor-not-allowed font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
