"use client";

import React, { useState } from "react";

/**
 * Tarjeta_Detalle — Current Exercise Display
 * Spec: openspec/specs/home-socio-portal/spec.md
 *   §Requirement: Tarjeta_Detalle Current Exercise Display
 * Business rules: RN-04 (single active routine, enforced upstream by the
 * caller/data layer — this component only renders whatever "current
 * exercise" it is given), RN-05 (equipment availability, see
 * getMachineAvailabilityMessage below).
 *
 * SCHEMA GAP (documented, not worked around silently):
 * `prisma/schema.prisma` has no relation between Ejercicio/EjercicioEnRutina
 * and Maquina, so there is no way yet to look up "the machine for this
 * exercise" from the domain layer. `maquina` and `objetivo` below are
 * therefore optional props: the caller (T-019 Home_Socio page, once that
 * lookup/data source exists) is responsible for resolving and passing them.
 * Until then this component degrades gracefully (MACHINE_STATUS_UNAVAILABLE
 * fallback, "—" placeholder for Objetivo) instead of fabricating data.
 */

export interface EjercicioActualInfo {
  nombre: string;
  grupoMuscular: string;
  descripcion?: string | null;
  /** Optional icon override (emoji or short glyph) for the icon circle. */
  icon?: string;
}

export interface EjercicioEnRutinaActual {
  series: number;
  repeticiones: number;
  /** Rest time in seconds, per Prisma's EjercicioEnRutina.descanso. */
  descanso: number;
}

export type EstadoMaquina =
  | "DISPONIBLE"
  | "OCUPADA"
  | "FUERA_DE_SERVICIO"
  | "INACTIVA";

export interface MaquinaInfo {
  estado: EstadoMaquina;
  /** Only meaningful when estado === "OCUPADA". */
  tiempoLibreEstimadoMin?: number | null;
}

export interface TarjetaDetalleProps {
  /** The current exercise, or null when there is no active routine. */
  ejercicio: EjercicioActualInfo | null;
  /** Series/reps/descanso for the current exercise, or null (see `ejercicio`). */
  ejercicioEnRutina: EjercicioEnRutinaActual | null;
  /**
   * Target weight for the "Objetivo" stat. Not yet modeled in the domain
   * (no ReglaDeProgresion/RegistroDeProgreso wiring exists at this layer),
   * so it is passed in pre-computed. Shows "—" when omitted.
   */
  objetivo?: string | number | null;
  /**
   * Machine info for the availability footer. Omit when unknown/unresolved
   * (e.g. schema gap above) — the footer then shows the
   * MACHINE_STATUS_UNAVAILABLE fallback per spec's Error Handling table.
   */
  maquina?: MaquinaInfo | null;
  /**
   * When provided, clicking the exercise name calls this instead of opening
   * the built-in modal — lets a parent own a richer modal (full description,
   * form variations, machine alternatives) once that data exists.
   */
  onOpenDetail?: () => void;
}

/**
 * Formats descanso (seconds) for display.
 * Spec (Data Scenarios + Edge Cases):
 *   120 -> "2 min" (round minutes read as "N min")
 *   125 -> "2:05"  (non-round values read as "M:SS")
 * This is intentionally different from the CRUD form's always-MM:SS
 * `formatDescansoDisplay` (rutina-crud/descanso-utils.ts), which is built
 * for editing, not for this read-only summary card.
 */
export function formatDescansoLabel(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * RN-05 / AC-004: a Fuera de Servicio or Inactiva machine must never be
 * reported as available. Also implements the MACHINE_STATUS_UNAVAILABLE
 * fallback from the spec's Error Handling table when data is missing.
 */
export function getMachineAvailabilityMessage(
  maquina: MaquinaInfo | null | undefined
): string {
  if (!maquina) {
    return "Consultar en recepción";
  }

  switch (maquina.estado) {
    case "DISPONIBLE":
      return "Máquina disponible";
    case "OCUPADA":
      return typeof maquina.tiempoLibreEstimadoMin === "number"
        ? `Libre en ~${maquina.tiempoLibreEstimadoMin} min`
        : "Ocupada";
    case "FUERA_DE_SERVICIO":
      return "Fuera de servicio";
    case "INACTIVA":
      return "No disponible";
    default:
      return "Consultar en recepción";
  }
}

function formatSeriesReps(series: number, repeticiones: number): string {
  return `${series}×${repeticiones}`;
}

export function TarjetaDetalle({
  ejercicio,
  ejercicioEnRutina,
  objetivo,
  maquina,
  onOpenDetail,
}: TarjetaDetalleProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!ejercicio || !ejercicioEnRutina) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        Sin rutina asignada
      </div>
    );
  }

  const handleNameClick = () => {
    if (onOpenDetail) {
      onOpenDetail();
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
        EJERCICIO ACTUAL
      </p>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl"
          aria-hidden="true"
        >
          {ejercicio.icon ?? "🏋️"}
        </div>
        <div>
          <button
            type="button"
            onClick={handleNameClick}
            className="text-left text-lg font-semibold text-gray-900 hover:underline"
          >
            {ejercicio.nombre}
          </button>
          <p className="text-sm text-gray-500">{ejercicio.grupoMuscular}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-gray-50 p-2">
          <p className="text-xs text-gray-500">Series×Reps</p>
          <p className="font-semibold text-gray-900">
            {formatSeriesReps(ejercicioEnRutina.series, ejercicioEnRutina.repeticiones)}
          </p>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <p className="text-xs text-gray-500">Descanso</p>
          <p className="font-semibold text-gray-900">
            {formatDescansoLabel(ejercicioEnRutina.descanso)}
          </p>
        </div>
        {/* AC-003: Objetivo uses the highlighted brand-fill styling */}
        <div className="rounded-md bg-blue-600 p-2 text-white">
          <p className="text-xs text-blue-100">Objetivo</p>
          <p className="font-semibold">{objetivo ?? "—"}</p>
        </div>
      </div>

      {ejercicio.descripcion && (
        <p className="mt-4 text-sm text-gray-600">{ejercicio.descripcion}</p>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
        {getMachineAvailabilityMessage(maquina)}
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ejercicio.nombre}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {ejercicio.nombre}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">{ejercicio.grupoMuscular}</p>
            {ejercicio.descripcion && (
              <p className="mt-4 text-sm text-gray-700">{ejercicio.descripcion}</p>
            )}
            {/*
              Form variations and machine alternatives from the spec's modal
              scenario aren't modeled in the schema yet (see SCHEMA GAP note
              above) — left as a visible TODO instead of fake data.
            */}
            <p className="mt-4 text-xs text-gray-400">
              Variantes de ejecución y máquinas alternativas: próximamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
