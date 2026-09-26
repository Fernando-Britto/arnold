/**
 * Cliente domain model
 * Represents a Socio (member/client) with membership and account status
 */

import { hashPassword } from "@/lib/auth";

/**
 * Estado de Cuenta enum
 */
export type EstadoCuenta = "Activo" | "Inactivo" | "Bloqueado";

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
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Generate a temporary password for new users
 * Format: TempPass-XXXXXX (where X are alphanumeric)
 * Must be changed on first login (not implemented yet, see T-013)
 */
export function generateTemporaryPassword(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TempPass-${randomSuffix}`;
}

/**
 * Map Socio.estadoCuota to Cliente.estadoCuenta
 * Socio tracks payment status (AL_DIA, VENCIDO, DENEGADO)
 * Cliente exposes account status (Activo, Inactivo, Bloqueado)
 */
export function mapEstadoCuotaToEstadoCuenta(
  estadoCuota: string
): EstadoCuenta {
  switch (estadoCuota) {
    case "AL_DIA":
      return "Activo";
    case "VENCIDO":
      return "Inactivo";
    case "DENEGADO":
      return "Bloqueado";
    default:
      return "Activo"; // Fallback
  }
}

/**
 * Map Cliente.estadoCuenta to Socio.estadoCuota (inverse of mapEstadoCuotaToEstadoCuenta)
 * Client exposes account status (Activo, Inactivo, Bloqueado)
 * Socio tracks payment status (AL_DIA, VENCIDO, DENEGADO)
 */
export function mapEstadoCuentaToEstadoCuota(estado: EstadoCuenta): string {
  switch (estado) {
    case "Activo":
      return "AL_DIA";
    case "Inactivo":
      return "VENCIDO";
    case "Bloqueado":
      return "DENEGADO";
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
 * Validate DNI format
 * Accepts both "XX.XXX.XXX" (with dots) and "XXXXXXXX" (digits only)
 */
function validateDNIFormat(dni: string): boolean {
  const withDots = /^\d{2}\.\d{3}\.\d{3}$/;
  const withoutDots = /^\d{8}$/;
  return withDots.test(dni) || withoutDots.test(dni);
}

/**
 * Validate email format
 */
function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (optional)
 * Accepts format: +54 9 XXXX XXXXXX
 */
function validatePhoneFormat(phone: string): boolean {
  const phoneRegex = /^\+54\s9\s\d{4}\s\d{6}$/;
  return phoneRegex.test(phone);
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
  } else if (!validateDNIFormat(data.dni)) {
    errors.push("El DNI debe tener formato XX.XXX.XXX o XXXXXXXX");
  }

  // Validate telefono (optional, but if provided must match format)
  if (data.telefono && data.telefono.trim() !== "") {
    if (!validatePhoneFormat(data.telefono)) {
      errors.push("El teléfono debe tener formato +54 9 XXXX XXXXXX");
    }
  }

  // Validate email (required, valid format)
  if (!data.email || data.email.trim() === "") {
    errors.push("El email es requerido");
  } else if (!validateEmailFormat(data.email)) {
    errors.push("Formato de email inválido");
  }

  // Validate membresiaAsignada (required, must be one of the active memberships)
  if (!data.membresiaAsignada || data.membresiaAsignada.trim() === "") {
    errors.push("Debe seleccionar una membresía activa");
  }

  // Validate estadoCuenta (required, one of the enum values)
  if (!data.estadoCuenta) {
    errors.push("El estado de cuenta es requerido");
  } else if (!["Activo", "Inactivo", "Bloqueado"].includes(data.estadoCuenta)) {
    errors.push("El estado de cuenta debe ser uno de: Activo, Inactivo, Bloqueado");
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
    data: Omit<Cliente, "id" | "fechaAlta" | "createdAt" | "updatedAt">
  ): Promise<CreateClienteResult> {
    const prisma = await this.getPrisma();

    // Validate first
    const validation = validateCliente(data);
    if (!validation.valid) {
      throw new Error(`VALIDATION_ERROR: ${validation.errors.join(", ")}`);
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
    
    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        password: hashedPassword,
        rol: "SOCIO" as const,
      },
    });

    // Then create Socio (Prisma will auto-set id and fechaAlta)
    const socio = await prisma.socio.create({
      data: {
        dni: normalizedDNI,
        telefono: data.telefono,
        membresiaAsignadaId: data.membresiaAsignada,
        estadoCuota: "AL_DIA",
        usuarioId: usuario.id,
      },
      include: { usuario: true },
    });

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
    data: Partial<Omit<Cliente, "id" | "fechaAlta" | "createdAt" | "updatedAt">>
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

    // Build update data
    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.dni !== undefined) updateData.dni = normalizeDNI(data.dni);
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.membresiaAsignada !== undefined)
      updateData.membresiaAsignadaId = data.membresiaAsignada;
    // H2 fix: Persist estadoCuenta as estadoCuota in Socio
    if (data.estadoCuenta !== undefined) {
      updateData.estadoCuota = mapEstadoCuentaToEstadoCuota(data.estadoCuenta);
    }

    // Update Usuario if needed
    if (data.nombre !== undefined || data.email !== undefined) {
      await prisma.usuario.update({
        where: { id: existing.usuarioId },
        data: {
          nombre: data.nombre ?? existing.usuario.nombre,
          email: data.email ?? existing.usuario.email,
        },
      });
    }

    // Update Socio
    const updated = await prisma.socio.update({
      where: { id },
      data: updateData,
      include: { usuario: true },
    });

    return this.mapSocioToCliente(updated);
  }

  /**
   * Delete a cliente
   * H4 fix: Use transaction to delete Socio + Usuario together to avoid orphaned users
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
