/**
 * Cliente domain model
 * Represents a Socio (member/client) with membership and account status
 */
import { randomBytes } from "node:crypto";
import type { EstadoCuota, Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { validarPin } from "@/domains/acceso/pin";
import { validateDNI, validateEmail, validatePhone } from "@/utils/validation";

/**
 * Estado de Cuenta enum (UI): la cuenta es femenina y `AL_DIA` = "Activa" (cuenta habilitada).
 */
export type EstadoCuenta = "Activa" | "Inactiva" | "Bloqueada";

/**
 * Cliente domain model
 */
export interface Cliente {
  id: string;
  nombre: string;
  dni: string; // Stored normalized (digits only)
  telefono?: string | null;
  email: string;
  membresiaAsignada: string; // ID of active Membresía
  estadoCuenta: EstadoCuenta;
  fechaAlta: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Response wrapper for ClienteRepository.create()
 * Includes the plaintext temporary password that MUST be communicated to the Socio
 * CRITICAL: Never expose this type in GET/LIST responses — tempPassword is ephemeral
 */
export interface CreateClienteResult {
  cliente: Cliente;
  tempPassword: string; // Plaintext, UNA SOLA VEZ, only in create response
}

/**
 * Datos de entrada para crear/editar un Cliente (Usuario + Socio).
 * `pin` es opcional (D-47): si viene, se valida que sean 4 dígitos y se guarda hasheado.
 */
export interface ClienteInput {
  nombre: string;
  dni: string;
  telefono?: string | null;
  email: string;
  membresiaAsignada: string;
  estadoCuenta: EstadoCuenta;
  /** PIN de 4 dígitos para el ingreso por DNI + PIN (D-47). */
  pin?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Alfabeto del sufijo temporal: mayúsculas y dígitos, como promete el formato `TempPass-XXXXXXXX`. */
const ALFABETO_TEMP_PASSWORD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a temporary password for new users
 * Format: TempPass-XXXXXXXX (8 uppercase alphanumerics)
 * Must be changed on first login (not implemented yet, see T-013)
 *
 * H10: el sufijo sale de `randomBytes` (CSPRNG), no de `Math.random()`, que no es apto para
 * credenciales. Se descartan los bytes que introducirían sesgo de módulo.
 */
export function generateTemporaryPassword(): string {
  const LARGO = 8;
  let sufijo = "";
  while (sufijo.length < LARGO) {
    for (const byte of randomBytes(LARGO)) {
      // 252 = 7 * 36: cada símbolo recibe exactamente 7 de los 256 valores posibles.
      if (byte >= 252) continue;
      sufijo += ALFABETO_TEMP_PASSWORD[byte % ALFABETO_TEMP_PASSWORD.length];
      if (sufijo.length === LARGO) break;
    }
  }
  return `TempPass-${sufijo}`;
}

/**
 * Map Socio.estadoCuota to Cliente.estadoCuenta (D-27, P-24)
 * `Socio.estadoCuota` es el estado de la CUENTA (AL_DIA | INACTIVA | BLOQUEADA); "Debe plata"
 * es un estado de pago calculado (D-40) y no se persiste acá. `AL_DIA` se muestra como "Activa"
 * (cuenta habilitada, no "pagó el mes").
 */
export function mapEstadoCuotaToEstadoCuenta(estadoCuota: EstadoCuota): EstadoCuenta {
  switch (estadoCuota) {
    case "AL_DIA":
      return "Activa";
    case "INACTIVA":
      return "Inactiva";
    case "BLOQUEADA":
      return "Bloqueada";
  }
}

/**
 * Map Cliente.estadoCuenta to Socio.estadoCuota (D-27, P-24)
 * Los tres estados de la pantalla tienen su propio valor en el enum, que ya no contiene estados de pago.
 */
export function mapEstadoCuentaToEstadoCuota(
  estado: EstadoCuenta
): "AL_DIA" | "INACTIVA" | "BLOQUEADA" {
  switch (estado) {
    case "Activa":
      return "AL_DIA";
    case "Inactiva":
      return "INACTIVA";
    case "Bloqueada":
      return "BLOQUEADA";
    default:
      return "AL_DIA";
  }
}

/**
 * Normalize DNI to digits-only format
 * Accepts both "XX.XXX.XXX" and "XXXXXXXX" formats
 */
export function normalizeDNI(dni: string): string {
  return dni.replace(/\D/g, "");
}

/**
 * Validate a Cliente object
 */
export function validateCliente(data: Partial<Cliente>): ValidationResult {
  const errors: string[] = [];

  // Validate nombre (required, 5-100 chars)
  if (!data.nombre || data.nombre.trim() === "") {
    errors.push("El nombre es requerido");
  } else if (data.nombre.length < 5) {
    errors.push("El nombre debe tener al menos 5 caracteres");
  } else if (data.nombre.length > 100) {
    errors.push("El nombre no puede exceder 100 caracteres");
  }

  // Validate DNI (required, unique, format XX.XXX.XXX or XXXXXXXX)
  if (!data.dni || data.dni.trim() === "") {
    errors.push("El DNI es requerido");
  } else if (!validateDNI(data.dni)) {
    errors.push("El DNI debe tener formato XX.XXX.XXX o XXXXXXXX");
  }

  // Validate telefono (optional, but if provided must match format)
  if (data.telefono && data.telefono.trim() !== "") {
    if (!validatePhone(data.telefono)) {
      errors.push("El teléfono debe tener formato +54 9 XXXX XXXXXX");
    }
  }

  // Validate email (required, valid format)
  if (!data.email || data.email.trim() === "") {
    errors.push("El email es requerido");
  } else if (!validateEmail(data.email)) {
    errors.push("Formato de email inválido");
  }

  // Validate membresiaAsignada (required, must be one of the active memberships)
  if (!data.membresiaAsignada || data.membresiaAsignada.trim() === "") {
    errors.push("Debe seleccionar una membresía activa");
  }

  // Validate estadoCuenta (required, one of the enum values)
  if (!data.estadoCuenta) {
    errors.push("El estado de cuenta es requerido");
  } else if (!["Activa", "Inactiva", "Bloqueada"].includes(data.estadoCuenta)) {
    errors.push("El estado de cuenta debe ser uno de: Activa, Inactiva, Bloqueada");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a Cliente with required fields (omitting id, fechaAlta, and timestamp fields)
 * These fields will be generated by Prisma on insert
 */
export function createCliente(
  nombre: string,
  dni: string,
  email: string,
  membresiaAsignada: string,
  estadoCuenta: EstadoCuenta,
  telefono?: string
): Omit<Cliente, "id" | "fechaAlta" | "createdAt" | "updatedAt"> {
  return {
    nombre,
    dni: normalizeDNI(dni),
    telefono: telefono || null,
    email,
    membresiaAsignada,
    estadoCuenta,
  };
}

/**
 * Cliente Repository for database operations
 * AC-007: id and fechaAlta are read-only (auto-generated by Prisma)
 * Maps Cliente domain model to Socio Prisma model
 */
export class ClienteRepository {
  private async getPrisma() {
    const { prisma } = await import("@/lib/db");
    return prisma;
  }

  /**
   * Create a new cliente in the database
   * Omits id, fechaAlta, createdAt, updatedAt — Prisma auto-generates
   * @returns CreateClienteResult with Cliente + plaintext tempPassword (ephemeral)
   * @throws "VALIDATION_DUPLICATE_DNI: DNI ya registrado" if DNI exists
   */
  async create(
    data: ClienteInput
  ): Promise<CreateClienteResult> {
    const prisma = await this.getPrisma();

    // Validate first
    const validation = validateCliente(data);
    if (!validation.valid) {
      throw new Error(`VALIDATION_ERROR: ${validation.errors.join(", ")}`);
    }

    // PIN opcional de acceso (D-47): si viene, tiene que ser de 4 dígitos.
    if (data.pin !== undefined && data.pin !== "" && !validarPin(data.pin)) {
      throw new Error("VALIDATION_ERROR: El PIN debe tener exactamente 4 dígitos");
    }

    // Check for duplicate DNI (normalized comparison)
    const normalizedDNI = normalizeDNI(data.dni);
    const existing = await prisma.socio.findUnique({
      where: { dni: normalizedDNI },
    });
    if (existing) {
      throw new Error("VALIDATION_DUPLICATE_DNI: DNI ya registrado");
    }

    // GAP 2: Validate that membresía exists and is ACTIVA
    // (Prevents accepting stale dropdown cache with INACTIVA membership)
    const membresia = await prisma.membresia.findUnique({
      where: { id: data.membresiaAsignada },
    });
    if (!membresia) {
      throw new Error("VALIDATION_MEMBERSHIP_NOT_FOUND: Membresía no encontrada");
    }
    if (membresia.estado !== "ACTIVA") {
      throw new Error(
        `MEMBERSHIP_NO_LONGER_ACTIVE: La membresía seleccionada ya no está activa`
      );
    }

    // Create Usuario with temporary password (hashed)
    // User must change password on first login (TODO: T-013 auth flow)
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const pinHash = data.pin ? await hashPassword(data.pin) : undefined;
    
    // P-04: Usuario y Socio se crean en UNA transacción; si el Socio falla (p. ej. DNI duplicado
    // por una carrera entre dos altas) se deshace también el Usuario y no queda uno huérfano.
    let socio;
    try {
      socio = await prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            nombre: data.nombre,
            email: data.email.trim().toLowerCase(),
            password: hashedPassword,
            rol: "SOCIO" as const,
          },
        });
        // Prisma setea id y fechaAlta
        return tx.socio.create({
          data: {
            dni: normalizedDNI,
            telefono: data.telefono,
            membresiaAsignadaId: data.membresiaAsignada,
            // H13: el alta respeta el estado de cuenta pedido (antes hardcodeaba
            // AL_DIA). `update` ya aplicaba el mismo mapeo.
            estadoCuota: mapEstadoCuentaToEstadoCuota(data.estadoCuenta),
            usuarioId: usuario.id,
            ...(pinHash ? { pinHash } : {}),
          },
          include: { usuario: true },
        });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        const target = (e as { meta?: { target?: unknown } }).meta?.target;
        const isDni = Array.isArray(target) ? target.includes("dni") : String(target ?? "").includes("dni");
        throw new Error(
          isDni ? "VALIDATION_DUPLICATE_DNI: DNI ya registrado" : "VALIDATION_DUPLICATE_EMAIL: Email ya registrado"
        );
      }
      throw e;
    }

    return {
      cliente: this.mapSocioToCliente(socio),
      tempPassword, // Returned ONLY in create response, never in GET/LIST
    };
  }

  /**
   * Retrieve all clientes
   */
  async list(): Promise<Cliente[]> {
    const prisma = await this.getPrisma();

    const socios = await prisma.socio.findMany({
      include: { usuario: true },
      orderBy: { updatedAt: "desc" as const },
    });

    return socios.map((s) => this.mapSocioToCliente(s));
  }

  /**
   * Retrieve a cliente by ID
   */
  async getById(id: string): Promise<Cliente | null> {
    const prisma = await this.getPrisma();

    const socio = await prisma.socio.findUnique({
      where: { id },
      include: { usuario: true },
    });

    return socio ? this.mapSocioToCliente(socio) : null;
  }

  /**
   * Update a cliente
   * AC-007: id and fechaAlta are read-only (never editable)
   */
  async update(
    id: string,
    data: Partial<ClienteInput>
  ): Promise<Cliente | null> {
    const prisma = await this.getPrisma();

    // Check if exists
    const existing = await prisma.socio.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!existing) {
      return null;
    }

    // Validate changed fields
    if (
      data.nombre !== undefined ||
      data.dni !== undefined ||
      data.email !== undefined ||
      data.membresiaAsignada !== undefined ||
      data.estadoCuenta !== undefined
    ) {
      // Map existing Socio to Cliente domain first (H1 fix)
      const existingCliente = this.mapSocioToCliente(existing);
      const merged = { ...existingCliente, ...data, id, fechaAlta: existing.fechaAlta };
      const validation = validateCliente(merged);
      if (!validation.valid) {
        throw new Error(`VALIDATION_ERROR: ${validation.errors.join(", ")}`);
      }

      // Check DNI uniqueness (excluding self)
      if (data.dni !== undefined) {
        const normalizedDNI = normalizeDNI(data.dni);
        const duplicate = await prisma.socio.findUnique({
          where: { dni: normalizedDNI },
        });
        if (duplicate && duplicate.id !== id) {
          throw new Error("VALIDATION_DUPLICATE_DNI: DNI ya registrado");
        }
      }

      // GAP 2: Validate that membresía exists and is ACTIVA (if updating)
      if (data.membresiaAsignada !== undefined) {
        const membresia = await prisma.membresia.findUnique({
          where: { id: data.membresiaAsignada },
        });
        if (!membresia) {
          throw new Error("VALIDATION_MEMBERSHIP_NOT_FOUND: Membresía no encontrada");
        }
        if (membresia.estado !== "ACTIVA") {
          throw new Error(
            `MEMBERSHIP_NO_LONGER_ACTIVE: La membresía seleccionada ya no está activa`
          );
        }
      }
    }

    // `nombre` y `email` son columnas de Usuario, no de Socio. Se escriben en una
    // transacción: Prisma no deja mezclar `usuario` anidado con `membresiaAsignadaId`.
    // PIN opcional de acceso (D-47): si viene, se valida; si se omite, no se toca.
    let pinHash: string | undefined;
    if (data.pin !== undefined && data.pin !== "") {
      if (!validarPin(data.pin)) {
        throw new Error("VALIDATION_ERROR: El PIN debe tener exactamente 4 dígitos");
      }
      pinHash = await hashPassword(data.pin);
    }

    const updateData: Prisma.SocioUncheckedUpdateInput = {};
    if (data.dni !== undefined) updateData.dni = normalizeDNI(data.dni);
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.membresiaAsignada !== undefined)
      updateData.membresiaAsignadaId = data.membresiaAsignada;
    if (data.estadoCuenta !== undefined) {
      updateData.estadoCuota = mapEstadoCuentaToEstadoCuota(data.estadoCuenta);
    }
    if (pinHash !== undefined) updateData.pinHash = pinHash;

    const usuarioChanges: Prisma.UsuarioUpdateInput = {};
    if (data.nombre !== undefined) usuarioChanges.nombre = data.nombre;
    if (data.email !== undefined)
      usuarioChanges.email = data.email.trim().toLowerCase();

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(usuarioChanges).length > 0) {
          await tx.usuario.update({
            where: { id: existing.usuarioId },
            data: usuarioChanges,
          });
        }
        return tx.socio.update({
          where: { id },
          data: updateData,
          include: { usuario: true },
        });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        throw new Error("VALIDATION_DUPLICATE_EMAIL: Email ya registrado");
      }
      throw e;
    }

    return this.mapSocioToCliente(updated);
  }

  /**
   * Delete a cliente
   * H4 fix: Use transaction to delete Socio + Usuario together to avoid orphaned users
   * PG-6/H2: Block the delete if the Socio has dependent history. `Asistencia`,
   * `SesionDeEntrenamiento` and `RegistroDeProgreso` use `onDelete: Restrict` (a raw
   * delete fails with P2003 → 500), while `Cuota` is `onDelete: Cascade` and
   * `Pago.socio` is `SetNull` (a raw delete would silently destroy cuotas and orphan
   * pagos). Blocking is the safe, intended behavior — soft-delete is out of scope.
   * @throws "NOT_FOUND" if the socio does not exist
   * @throws "DELETE_BLOCKED_REFERENCES: ..." if it has dependent records
   */
  async delete(id: string): Promise<void> {
    const prisma = await this.getPrisma();

    // Check if exists
    const cliente = await prisma.socio.findUnique({
      where: { id },
    });
    if (!cliente) {
      throw new Error("NOT_FOUND");
    }

    // Count every dependent relation that either restricts or would be destroyed/orphaned.
    const [asistencias, sesiones, progreso, pagos, cuotas] = await Promise.all([
      prisma.asistencia.count({ where: { socioId: id } }),
      prisma.sesionDeEntrenamiento.count({ where: { socioId: id } }),
      prisma.registroDeProgreso.count({ where: { socioId: id } }),
      prisma.pago.count({ where: { socioId: id } }),
      prisma.cuota.count({ where: { socioId: id } }),
    ]);

    if (asistencias + sesiones + progreso + pagos + cuotas > 0) {
      throw new Error(
        "DELETE_BLOCKED_REFERENCES: No se puede eliminar el cliente porque tiene historial (asistencias, sesiones, progreso, pagos o cuotas)"
      );
    }

    // Delete Socio and Usuario in transaction to free email constraint
    await prisma.$transaction([
      prisma.socio.delete({ where: { id } }),
      prisma.usuario.delete({ where: { id: cliente.usuarioId } }),
    ]);
  }

  /**
   * Helper: map Socio to Cliente domain model
   */
  private mapSocioToCliente(socio: any): Cliente {
    return {
      id: socio.id,
      nombre: socio.usuario?.nombre || "",
      dni: socio.dni,
      telefono: socio.telefono,
      email: socio.usuario?.email || "",
      membresiaAsignada: socio.membresiaAsignadaId || "",
      estadoCuenta: mapEstadoCuotaToEstadoCuenta(socio.estadoCuota),
      fechaAlta: socio.fechaAlta,
      updatedAt: socio.updatedAt,
    };
  }
}
