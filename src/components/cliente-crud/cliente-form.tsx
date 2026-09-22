import React, { useState, useEffect } from "react";
import { validateCliente, type EstadoCuenta } from "@/domains/cliente/cliente";

/**
 * Format a date to DD/MM/YYYY safely without timezone issues
 * Handles dates that come from API or tests by using local components
 */
function formatDateDDMMYYYY(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

export interface ClienteFormProps {
  onSave: (data: {
    id?: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string;
    membresiaAsignada: string;
    estadoCuenta: EstadoCuenta;
  }) => Promise<void> | void;
  initialData: {
    id?: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string | null;
    membresiaAsignada: string;
    estadoCuenta: EstadoCuenta;
    fechaAlta?: Date;
  } | null;
  availableMembresias: Array<{
    id: string;
    nombre: string;
    precio: number;
    estado: "ACTIVA" | "INACTIVA";
  }>;
  isLoading?: boolean;
}

interface FormState {
  id?: string;
  nombre: string;
  dni: string;
  email: string;
  telefono: string;
  membresiaAsignada: string;
  estadoCuenta: EstadoCuenta;
}

interface ValidationErrors {
  [key: string]: string;
}

export function ClienteForm({
  onSave,
  initialData,
  availableMembresias,
  isLoading = false,
}: ClienteFormProps) {
  const [formData, setFormData] = useState<FormState>({
    id: initialData?.id || undefined,
    nombre: initialData?.nombre || "",
    dni: initialData?.dni || "",
    email: initialData?.email || "",
    telefono: initialData?.telefono || "",
    membresiaAsignada: initialData?.membresiaAsignada || "",
    estadoCuenta: initialData?.estadoCuenta || "Activo",
  });

  const [fechaAlta, setFechaAlta] = useState<Date | undefined>(initialData?.fechaAlta);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        nombre: initialData.nombre,
        dni: initialData.dni,
        email: initialData.email,
        telefono: initialData.telefono || "",
        membresiaAsignada: initialData.membresiaAsignada,
        estadoCuenta: initialData.estadoCuenta,
      });
      setFechaAlta(initialData.fechaAlta);
      setErrors({});
    } else {
      setFormData({
        nombre: "",
        dni: "",
        email: "",
        telefono: "",
        membresiaAsignada: "",
        estadoCuenta: "Activo",
      });
      setFechaAlta(undefined);
      setErrors({});
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts editing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    // DNI uniqueness check on blur would happen here (server-side in real app)
    // For now, just validate format
    if (name === "dni") {
      const validation = validateCliente({
        ...formData,
        [name]: formData[name as keyof FormState],
      });
      if (validation.errors.some((err) => err.includes("DNI"))) {
        setErrors((prev) => ({
          ...prev,
          dni: validation.errors.find((err) => err.includes("DNI")) || "",
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const validation = validateCliente(formData);
    if (!validation.valid) {
      const errorMap: ValidationErrors = {};
      validation.errors.forEach((error) => {
        if (error.includes("nombre")) errorMap.nombre = error;
        if (error.includes("DNI") || error.includes("dni"))
          errorMap.dni = error;
        if (error.includes("email")) errorMap.email = error;
        if (error.includes("teléfono"))
          errorMap.telefono = error;
        if (error.includes("membresía"))
          errorMap.membresiaAsignada = error;
        if (error.includes("estado de cuenta"))
          errorMap.estadoCuenta = error;
      });
      setErrors(errorMap);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: formData.id,
        nombre: formData.nombre,
        dni: formData.dni,
        email: formData.email,
        telefono: formData.telefono || undefined,
        membresiaAsignada: formData.membresiaAsignada,
        estadoCuenta: formData.estadoCuenta,
      });
    } catch (error) {
      // Error handling for API errors would happen here
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMembresias = availableMembresias.filter(
    (m) => m.estado === "ACTIVA"
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
      <h2 className="text-lg font-semibold mb-4">
        {initialData?.id ? "Editar Cliente" : "Nuevo Cliente"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ID (read-only) */}
        {initialData?.id && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID
            </label>
            <input
              type="text"
              value={initialData.id}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
        )}

        {/* Fecha de Alta (read-only) */}
        {fechaAlta && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Alta
            </label>
            <input
              type="text"
              value={formatDateDDMMYYYY(fechaAlta)}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
        )}

        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>
          <input
            id="nombre"
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="e.g., Ana García"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.nombre
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.nombre && (
            <p className="text-red-600 text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        {/* DNI */}
        <div>
          <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-1">
            DNI *
          </label>
          <input
            id="dni"
            type="text"
            name="dni"
            value={formData.dni}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="XX.XXX.XXX o XXXXXXXX"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.dni ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.dni && (
            <p className="text-red-600 text-sm mt-1">{errors.dni}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="ana@example.com"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.email
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono (opcional)
          </label>
          <input
            id="telefono"
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            placeholder="+54 9 XXXX XXXXXX"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.telefono
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {errors.telefono && (
            <p className="text-red-600 text-sm mt-1">{errors.telefono}</p>
          )}
        </div>

        {/* Membresía Asignada */}
        <div>
          <label htmlFor="membresiaAsignada" className="block text-sm font-medium text-gray-700 mb-1">
            Membresía Asignada *
          </label>
          {activeMembresias.length === 0 ? (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">
              No hay membresías activas
            </div>
          ) : (
            <select
              id="membresiaAsignada"
              name="membresiaAsignada"
              value={formData.membresiaAsignada}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.membresiaAsignada
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300"
              }`}
            >
              <option value="">Seleccionar membresía...</option>
              {activeMembresias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} - ${m.precio.toFixed(2)}
                </option>
              ))}
            </select>
          )}
          {errors.membresiaAsignada && (
            <p className="text-red-600 text-sm mt-1">{errors.membresiaAsignada}</p>
          )}
        </div>

        {/* Estado de Cuenta */}
        <div>
          <label htmlFor="estadoCuenta" className="block text-sm font-medium text-gray-700 mb-1">
            Estado de Cuenta *
          </label>
          <select
            id="estadoCuenta"
            name="estadoCuenta"
            value={formData.estadoCuenta}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.estadoCuenta
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Bloqueado">Bloqueado</option>
          </select>
          {errors.estadoCuenta && (
            <p className="text-red-600 text-sm mt-1">{errors.estadoCuenta}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isLoading || activeMembresias.length === 0}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? "Guardando..." : initialData?.id ? "Actualizar" : "Crear"}
        </button>
      </form>
    </div>
  );
}
