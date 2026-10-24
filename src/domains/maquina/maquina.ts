import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

export type { EstadoMaquina, TipoEquipamiento };

export const ESTADOS_ASIGNABLES = [
  "DISPONIBLE",
  "FUERA_DE_SERVICIO",
  "INACTIVA",
] as const;

export type EstadoAsignable = (typeof ESTADOS_ASIGNABLES)[number];

export const TIPOS_EQUIPAMIENTO = [
  "MAQUINA_GUIADA",
  "PESO_LIBRE",
  "CARDIO",
] as const;

export interface Maquina {
  id: string;
  nombre: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoMaquina;
  ubicacion: string;
  fechaAlta: Date;
  updatedAt: Date;
}

export interface MaquinaInput {
  nombre?: string;
  ubicacion?: string;
  tipoEquipamiento?: TipoEquipamiento;
  estado?: EstadoMaquina;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

export function validateMaquina(
  data: MaquinaInput,
  options: { partial?: boolean } = {}
): ValidationResult {
  const { partial = false } = options;
  const errors: string[] = [];

  if (!partial || data.nombre !== undefined) {
    const nombre = normalizarTexto(data.nombre ?? "");
    if (nombre.length < 2 || nombre.length > 80) {
      errors.push("El nombre debe tener entre 2 y 80 caracteres");
    }
  }

  if (!partial || data.ubicacion !== undefined) {
    const ubicacion = normalizarTexto(data.ubicacion ?? "");
    if (ubicacion.length < 2 || ubicacion.length > 80) {
      errors.push("La ubicación debe tener entre 2 y 80 caracteres");
    }
  }

  if (!partial || data.tipoEquipamiento !== undefined) {
    if (
      !data.tipoEquipamiento ||
      !TIPOS_EQUIPAMIENTO.includes(
        data.tipoEquipamiento as (typeof TIPOS_EQUIPAMIENTO)[number]
      )
    ) {
      errors.push("Tipo de equipamiento inválido");
    }
  }

  if (!partial || data.estado !== undefined) {
    if (data.estado === "OCUPADA") {
      errors.push("El estado OCUPADA no puede asignarse desde este panel");
    } else if (
      !data.estado ||
      !ESTADOS_ASIGNABLES.includes(data.estado as EstadoAsignable)
    ) {
      errors.push("Estado inválido");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeMaquina(data: {
  nombre: string;
  ubicacion: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoAsignable;
}): {
  nombre: string;
  ubicacion: string;
  tipoEquipamiento: TipoEquipamiento;
  estado: EstadoAsignable;
} {
  return {
    nombre: normalizarTexto(data.nombre),
    ubicacion: normalizarTexto(data.ubicacion),
    tipoEquipamiento: data.tipoEquipamiento,
    estado: data.estado,
  };
}

export const MAX_EJERCIOS_POR_MAQUINA = 100;

export interface EjercicioAsociado {
  id: string;
  nombre: string;
  grupoMuscular: string;
}

export type ErrorAsignacion = "VALIDATION_ERROR" | "VALIDATION_MAX_EJERCICIOS";

export type ResultadoAsignacion =
  | { ok: true; ejercicioIds: string[] }
  | { ok: false; code: ErrorAsignacion; message: string };

export function validarAsignacionEjercicios(
  ejercicioIds: string[],
  existentes: ReadonlySet<string>
): ResultadoAsignacion {
  if (new Set(ejercicioIds).size !== ejercicioIds.length) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Hay ejercicios duplicados en la asignación",
    };
  }

  if (ejercicioIds.length > MAX_EJERCIOS_POR_MAQUINA) {
    return {
      ok: false,
      code: "VALIDATION_MAX_EJERCICIOS",
      message: `No se pueden asignar más de ${MAX_EJERCIOS_POR_MAQUINA} ejercicios a una máquina`,
    };
  }

  if (ejercicioIds.some((id) => !existentes.has(id))) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Uno o más ejercicios no existen",
    };
  }

  return { ok: true, ejercicioIds };
}

export function puedeEliminar(
  _maquina: Maquina,
  context: { ejerciciosAsociados: number }
): { permitido: boolean; motivo: string | null } {
  if (context.ejerciciosAsociados > 0) {
    return {
      permitido: false,
      motivo: `${context.ejerciciosAsociados} ejercicios usan esta máquina`,
    };
  }
  return { permitido: true, motivo: null };
}
