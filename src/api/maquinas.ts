/**
 * Handlers de servidor y envoltorios cliente para el catálogo de máquinas.
 * T-053f — slice PR-1a-4.
 */

import {
  validateMaquina,
  normalizeMaquina,
  puedeEliminar,
  type Maquina,
  type MaquinaInput,
  type EstadoMaquina,
  type TipoEquipamiento,
} from "@/domains/maquina/maquina";
import { maquinaRepository } from "@/domains/maquina/maquina-repositorio";

type CodedError = Error & { code?: string };

function codedError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  (error as CodedError).code = code;
  return error;
}

function definedFields(input: MaquinaInput): Partial<MaquinaInput> {
  const result: Partial<MaquinaInput> = {};
  if (input.nombre !== undefined) result.nombre = input.nombre;
  if (input.ubicacion !== undefined) result.ubicacion = input.ubicacion;
  if (input.tipoEquipamiento !== undefined) result.tipoEquipamiento = input.tipoEquipamiento;
  if (input.estado !== undefined) result.estado = input.estado;
  return result;
}

export async function handleMaquinaList(filters: {
  estado?: EstadoMaquina;
  tipoEquipamiento?: TipoEquipamiento;
  nombre?: string;
} = {}): Promise<Maquina[]> {
  return maquinaRepository.getAll(filters);
}

export async function handleMaquinaCreate(input: MaquinaInput): Promise<Maquina> {
  if (input.estado === "OCUPADA") {
    throw codedError(
      "ESTADO_NO_ASIGNABLE",
      "El estado OCUPADA no puede asignarse desde este panel"
    );
  }

  const validation = validateMaquina(input);
  if (!validation.valid) {
    throw codedError("VALIDATION_ERROR", validation.errors[0]);
  }

  const normalized = normalizeMaquina({
    nombre: input.nombre!,
    ubicacion: input.ubicacion!,
    tipoEquipamiento: input.tipoEquipamiento!,
    estado: input.estado!,
  });

  return maquinaRepository.create(normalized);
}

export async function handleMaquinaGetById(id: string): Promise<Maquina> {
  const maquina = await maquinaRepository.getById(id);

  if (!maquina) {
    throw codedError("NOT_FOUND", "Máquina no encontrada");
  }

  return maquina;
}

export async function handleMaquinaUpdate(
  id: string,
  input: MaquinaInput
): Promise<Maquina> {
  const existing = await maquinaRepository.getById(id);

  if (!existing) {
    throw codedError("NOT_FOUND", "Máquina no encontrada");
  }

  const merged = {
    ...existing,
    ...definedFields(input),
  };

  if (merged.estado === "OCUPADA") {
    throw codedError(
      "ESTADO_NO_ASIGNABLE",
      "El estado OCUPADA no puede asignarse desde este panel"
    );
  }

  const validation = validateMaquina(merged);
  if (!validation.valid) {
    throw codedError("VALIDATION_ERROR", validation.errors[0]);
  }

  const normalized = normalizeMaquina({
    nombre: merged.nombre,
    ubicacion: merged.ubicacion,
    tipoEquipamiento: merged.tipoEquipamiento,
    estado: merged.estado,
  });

  return maquinaRepository.update(id, normalized);
}

export async function handleMaquinaDelete(id: string): Promise<void> {
  const existing = await maquinaRepository.getById(id);

  if (!existing) {
    throw codedError("NOT_FOUND", "Máquina no encontrada");
  }

  const decision = puedeEliminar(existing, { ejerciciosAsociados: 0 });

  if (!decision.permitido) {
    throw codedError(
      "DELETE_BLOCKED_EJERCICIOS",
      `No se puede eliminar: ${decision.motivo}`
    );
  }

  await maquinaRepository.delete(id);
}
