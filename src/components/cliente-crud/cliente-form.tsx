import React, { useState, useEffect, useRef } from "react";
import { validateCliente, type EstadoCuenta } from "@/domains/cliente/cliente";
import { formatMoney } from "@/utils/formatting";
import { fetchSocioPorDni } from "@/api/socios";

/**
 * Format a date to DD/MM/YYYY safely without timezone issues
 * Handles both Date objects and ISO string dates from API
 * Uses UTC components to handle ISO dates from API (which represent calendar dates, not instants)
 * A date like "2024-01-15" semantically means Jan 15 regardless of where the code runs
 */
function formatDateDDMMYYYY(date: Date | string): string {
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return "";
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
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
    /** PIN de 4 dígitos para el ingreso por DNI + PIN (D-47). Opcional. */
    pin?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
  initialData: {
    id?: string;
    nombre: string;
    dni: string;
    email: string;
    telefono?: string | null;
    membresiaAsignada: string;
    estadoCuenta: EstadoCuenta;
    fechaAlta?: Date | string;
  } | null;
  availableMembresias: Array<{
    id: string;
    nombre: string;
    precio: number;
    estado: "ACTIVA" | "INACTIVA";
  }>;
  isLoading?: boolean;
  /**
   * El desplegable de membresías viaja en su propia carga: mientras llega, el panel
   * muestra el form completo (precarga) con el select en estado "cargando".
   */
  membresiasLoading?: boolean;
}

interface FormState {
  id?: string;
  nombre: string;
  dni: string;
  email: string;
  telefono: string;
  membresiaAsignada: string;
  estadoCuenta: EstadoCuenta;
  pin: string;
}

interface ValidationErrors {
  [key: string]: string;
}

/** H8: mensaje único del control de unicidad de DNI (AC-002), verificado al perder foco. */
const DNI_DUPLICADO = "El DNI ya está registrado";

/**
 * Form de Cliente. NO dibuja su propio marco ni su título: los aporta `FormPanelShell`
 * (igual que EjercicioForm/RutinaForm), así el panel mide los 380px del diseño en todas
 * las pantallas CRUD en lugar de los 448px de un `max-w-md` propio.
 */
export function ClienteForm({
  onSave,
  onCancel,
  initialData,
  availableMembresias,
  isLoading = false,
  membresiasLoading = false,
}: ClienteFormProps) {
  const [formData, setFormData] = useState<FormState>({
    id: initialData?.id || undefined,
    nombre: initialData?.nombre || "",
    dni: initialData?.dni || "",
    email: initialData?.email || "",
    telefono: initialData?.telefono || "",
    membresiaAsignada: initialData?.membresiaAsignada || "",
    estadoCuenta: initialData?.estadoCuenta || "Activa",
    pin: "",
  });

  const [fechaAlta, setFechaAlta] = useState<Date | string | undefined>(initialData?.fechaAlta);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Último valor tipeado en DNI: descarta la respuesta de una verificación que llegó tarde.
  const dniValueRef = useRef("");
  // H8: el DNI duplicado se representa en `errors.dni` (así el reset del form lo limpia solo).
  const dniDuplicate = errors.dni === DNI_DUPLICADO;

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el reset del formulario de edición se sincroniza desde props; reescribirlo durante el render cambiaría el momento del update de estado.
      setFormData({
        id: initialData.id,
        nombre: initialData.nombre,
        dni: initialData.dni,
        email: initialData.email,
        telefono: initialData.telefono || "",
        membresiaAsignada: initialData.membresiaAsignada,
        estadoCuenta: initialData.estadoCuenta,
        pin: "",
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
        estadoCuenta: "Activa",
        pin: "",
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
    if (name === "dni") {
      dniValueRef.current = value;
    }
    // Clear error for this field when user starts editing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name !== "dni") return;

    // 1) Formato (comportamiento previo): DNI vacío o con formato inválido no se consulta.
    const validation = validateCliente({ ...formData, dni: value });
    const formatError = validation.errors.find((err) => err.includes("DNI"));
    if (formatError) {
      setErrors((prev) => ({ ...prev, dni: formatError }));
      return;
    }

    const normalized = value.trim();
    if (normalized === "") return;
    dniValueRef.current = normalized;
    setErrors((prev) => {
      const next = { ...prev };
      delete next.dni;
      return next;
    });

    // 2) Unicidad (AC-002 / spec clientes-crud: "checked on field blur before full
    // submission"). Reusa GET /api/socios?dni=, que normaliza el DNI. El guard del
    // servidor (VALIDATION_DUPLICATE_DNI) sigue siendo la fuente de verdad.
    try {
      const existing = await fetchSocioPorDni(normalized);
      if (dniValueRef.current !== normalized) return; // respuesta tardía: el campo cambió
      // En edición el propio DNI del cliente no es un duplicado.
      if (existing.id !== initialData?.id) {
        setErrors((prev) => ({ ...prev, dni: DNI_DUPLICADO }));
      }
    } catch {
      // NOT_FOUND => el DNI está disponible. Cualquier otro fallo (red/permisos) no bloquea
      // el alta: el guard del servidor decide al enviar.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const validation = validateCliente(formData);
    const errorMap: ValidationErrors = {};
    if (!validation.valid) {
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
    }

    // PIN opcional (D-47): si se completa tiene que tener exactamente 4 dígitos.
    const pin = formData.pin.trim();
    if (pin !== "" && !/^\d{4}$/.test(pin)) {
      errorMap.pin = "El PIN debe tener exactamente 4 dígitos";
    }

    // H8: si el blur marcó el DNI como duplicado, se bloquea el envío (el servidor re-valida igual).
    if (dniDuplicate) {
      errorMap.dni = DNI_DUPLICADO;
    }

    if (Object.keys(errorMap).length > 0) {
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
        pin: pin !== "" ? pin : undefined,
      });
      // H5: tras un alta exitosa el form vuelve a vacío. En el alta `setEditing(null)` del
      // page es un no-op, así que sin esto los valores quedaban y una segunda alta los reenviaba.
      if (!formData.id) {
        setFormData({
          nombre: "",
          dni: "",
          email: "",
          telefono: "",
          membresiaAsignada: "",
          estadoCuenta: "Activa",
          pin: "",
        });
        setFechaAlta(undefined);
        setErrors({});
        dniValueRef.current = "";
      }
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
    <div className="flex flex-col">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ID (read-only) */}
        {initialData?.id && (
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1">
              ID
            </label>
            <input
              type="text"
              value={initialData.id}
              disabled
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-subtle text-ink-soft cursor-not-allowed"
            />
          </div>
        )}

        {/* Fecha de Alta (read-only) */}
        {fechaAlta && (
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Fecha de Alta
            </label>
            <input
              type="text"
              value={formatDateDDMMYYYY(fechaAlta)}
              disabled
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-subtle text-ink-soft cursor-not-allowed"
            />
          </div>
        )}

        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-ink-soft mb-1">
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
                ? "border-danger bg-danger-soft"
                : "border-border"
            }`}
          />
          {errors.nombre && (
            <p className="text-danger text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        {/* DNI */}
        <div>
          <label htmlFor="dni" className="block text-sm font-medium text-ink-soft mb-1">
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
              errors.dni ? "border-danger bg-danger-soft" : "border-border"
            }`}
          />
          {errors.dni && (
            <p className="text-danger text-sm mt-1">{errors.dni}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-soft mb-1">
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
                ? "border-danger bg-danger-soft"
                : "border-border"
            }`}
          />
          {errors.email && (
            <p className="text-danger text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium text-ink-soft mb-1">
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
                ? "border-danger bg-danger-soft"
                : "border-border"
            }`}
          />
          {errors.telefono && (
            <p className="text-danger text-sm mt-1">{errors.telefono}</p>
          )}
        </div>

        {/* PIN de acceso (opcional) */}
        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-ink-soft mb-1">
            PIN (4 dígitos)
          </label>
          <input
            id="pin"
            type="password"
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={formData.pin}
            onChange={handleChange}
            placeholder="••••"
            aria-describedby="pin-hint"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.pin ? "border-danger bg-danger-soft" : "border-border"
            }`}
          />
          <p id="pin-hint" className="text-xs text-ink-muted mt-1">
            Se usa para el ingreso por DNI + PIN. Dejalo vacío para no cambiarlo.
          </p>
          {errors.pin && (
            <p className="text-danger text-sm mt-1">{errors.pin}</p>
          )}
        </div>

        {/* Membresía Asignada */}
        <div>
          <label htmlFor="membresiaAsignada" className="block text-sm font-medium text-ink-soft mb-1">
            Membresía Asignada *
          </label>
          {membresiasLoading ? (
            <div
              aria-busy="true"
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-hover text-ink-muted text-sm"
            >
              Cargando membresías...
            </div>
          ) : activeMembresias.length === 0 ? (
            <div className="w-full px-3 py-2 border border-border rounded-md bg-surface-hover text-ink-muted text-sm">
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
                  ? "border-danger bg-danger-soft"
                  : "border-border"
              }`}
            >
              <option value="">Seleccionar membresía...</option>
              {activeMembresias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} - {formatMoney(m.precio)}
                </option>
              ))}
            </select>
          )}
          {errors.membresiaAsignada && (
            <p className="text-danger text-sm mt-1">{errors.membresiaAsignada}</p>
          )}
        </div>

        {/* Estado de Cuenta */}
        <div>
          <label htmlFor="estadoCuenta" className="block text-sm font-medium text-ink-soft mb-1">
            Estado de Cuenta *
          </label>
          <select
            id="estadoCuenta"
            name="estadoCuenta"
            value={formData.estadoCuenta}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.estadoCuenta
                ? "border-danger bg-danger-soft"
                : "border-border"
            }`}
          >
            <option value="Activa">Activa</option>
            <option value="Inactiva">Inactiva</option>
            <option value="Bloqueada">Bloqueada</option>
          </select>
          {errors.estadoCuenta && (
            <p className="text-danger text-sm mt-1">{errors.estadoCuenta}</p>
          )}
        </div>

        {/* Submit & Cancel Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              isLoading ||
              membresiasLoading ||
              dniDuplicate ||
              activeMembresias.length === 0
            }
            className="flex-1 rounded-md bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
          >
            {isSubmitting ? "Guardando..." : initialData?.id ? "Actualizar" : "Crear"}
          </button>
          {initialData?.id && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 bg-surface-active text-ink-soft rounded-md hover:bg-surface-active font-medium disabled:bg-surface-subtle disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
