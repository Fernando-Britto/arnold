"use client";

import React, { useState } from "react";
import { validateMembresia, type Membresia, type EstadoMembresia } from "@/domains/membresia/membresia";

interface ValidationErrors {
  [key: string]: string;
}

interface MembresiaFormProps {
  initialData?: Membresia | null;
  onSave: (data: {
    nombre: string;
    precio: number;
    periodicidad: number;
    descripcion?: string;
    estado: EstadoMembresia;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MembresiaForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: MembresiaFormProps) {
  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || "",
    precio: initialData?.precio || "",
    periodicidad: initialData?.periodicidad || "",
    descripcion: initialData?.descripcion || "",
    estado: initialData?.estado || "ACTIVA" as EstadoMembresia,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Normalize precio to 2 decimals on blur
    if (name === "precio" && value) {
      const precioNum = parseFloat(value);
      if (!isNaN(precioNum)) {
        const normalized = (Math.round(precioNum * 100) / 100).toFixed(2);
        setFormData((prev) => ({
          ...prev,
          precio: normalized,
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const numericPrecio = formData.precio ? parseFloat(formData.precio.toString()) : undefined;
    const numericPeriodicidad = formData.periodicidad
      ? parseInt(formData.periodicidad.toString(), 10)
      : undefined;

    const validation = validateMembresia({
      nombre: formData.nombre,
      precio: numericPrecio,
      periodicidad: numericPeriodicidad,
      descripcion: formData.descripcion,
      estado: formData.estado,
    });

    if (!validation.valid) {
      const newErrors: ValidationErrors = {};
      validation.errors.forEach((error) => {
        // Map error messages to field names
        if (error.includes("nombre")) newErrors.nombre = error;
        if (error.includes("precio")) newErrors.precio = error;
        if (error.includes("periodicidad")) newErrors.periodicidad = error;
        if (error.includes("descripción")) newErrors.descripcion = error;
        if (error.includes("estado")) newErrors.estado = error;
      });
      setErrors(newErrors);
      return;
    }

    // Call onSave with validated data
    onSave({
      nombre: formData.nombre,
      precio: numericPrecio!,
      periodicidad: numericPeriodicidad!,
      descripcion: formData.descripcion || undefined,
      estado: formData.estado,
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
      <h2 className="text-lg font-semibold mb-4">
        {initialData?.id ? "Editar Membresía" : "Nueva Membresía"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Gold, Silver, Bronze"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.nombre ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.nombre && <p className="text-red-600 text-sm mt-1">{errors.nombre}</p>}
        </div>

        {/* Precio */}
        <div>
          <label htmlFor="precio" className="block text-sm font-medium text-gray-700 mb-1">
            Precio (ARS) *
          </label>
          <input
            type="number"
            id="precio"
            name="precio"
            value={formData.precio}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Ej: 15000.00"
            step="0.01"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.precio ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.precio && <p className="text-red-600 text-sm mt-1">{errors.precio}</p>}
        </div>

        {/* Periodicidad */}
        <div>
          <label htmlFor="periodicidad" className="block text-sm font-medium text-gray-700 mb-1">
            Periodicidad (días) *
          </label>
          <input
            type="number"
            id="periodicidad"
            name="periodicidad"
            value={formData.periodicidad}
            onChange={handleChange}
            placeholder="Ej: 30"
            step="1"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.periodicidad ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.periodicidad && (
            <p className="text-red-600 text-sm mt-1">{errors.periodicidad}</p>
          )}
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Descripción opcional de la membresía (máx 300 caracteres)"
            rows={3}
            maxLength={300}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.descripcion ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.descripcion && (
            <p className="text-red-600 text-sm mt-1">{errors.descripcion}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            {formData.descripcion.length}/300 caracteres
          </p>
        </div>

        {/* Estado */}
        <div>
          <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
            Estado *
          </label>
          <select
            id="estado"
            name="estado"
            value={formData.estado}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.estado ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          >
            <option value="ACTIVA">Activa</option>
            <option value="INACTIVA">Inactiva</option>
          </select>
          {errors.estado && <p className="text-red-600 text-sm mt-1">{errors.estado}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
