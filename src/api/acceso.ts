/**
 * Servicio de acceso al gimnasio (T-035, D-47):
 *  - definir el PIN de 4 dígitos de un socio (recepción, primera vez),
 *  - check-in por DNI + PIN con la decisión pura de `src/domains/acceso/check-in.ts`.
 *
 * D-46: la cuenta (`Socio.estadoCuota`) se separa del pago calculado (`estadoCuotaSocio`, D-40).
 * Prisma se importa en forma diferida: este módulo también expone helpers de fetch para el cliente.
 */
import type { EstadoCuota as PrismaEstadoCuota } from "@prisma/client";
import {
  estadoCuotaSocio,
  fechaLimitePago,
  periodoDe,
  type EstadoCuotaSocio,
} from "@/domains/pago/cuota";
import {
  DIA_LIMITE_PAGO_DEFAULT,
  PERIODO_GRACIA_DEFAULT,
} from "@/domains/pago/registrar-pago";
import {
  decidirAcceso,
  type EstadoCuenta,
  type ResultadoAcceso,
} from "@/domains/acceso/check-in";
import { validarPin } from "@/domains/acceso/pin";
import { hashPassword, comparePassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { toGymWallClock } from "@/lib/gym-time";
import { throwIfNotOk } from "@/utils/api-error";

/** Ventana de anti-passback (P-33, valor aún abierto): no se permite un segundo ingreso dentro de ella. */
export const VENTANA_ANTI_PASSBACK_MINUTOS = 60;
/** Intentos de check-in por IP y minuto (reutiliza `rateLimit`, como el login). */
export const LIMITE_INTENTOS_CHECK_IN_POR_MINUTO = 20;
const RATE_LIMIT_ROUTE = "acceso:check-in";
/** Mensaje único para DNI o PIN incorrectos: no se revela cuál de los dos falló. */
export const MENSAJE_IDENTIDAD_INVALIDA = "DNI o PIN incorrectos";
export const MENSAJE_RATE_LIMIT = "Demasiados intentos. Probá de nuevo en un minuto.";

/** PIN válido: exactamente 4 dígitos (se permiten ceros a la izquierda). Definido en el dominio. */
export { validarPin };

interface PrismaLike {
  socio: {
    findUnique(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  cuota: { findFirst(args: unknown): Promise<{ fechaVencimiento: Date } | null> };
  configuracionDelSistema: {
    findFirst(): Promise<{ diaLimitePago: number; periodoGracia: number } | null>;
  };
  asistencia: {
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  auditoriaAcceso: { create(args: unknown): Promise<unknown> };
}

/**
 * Estado de la cuenta a partir de `Socio.estadoCuota` (D-46). Los valores de pago que quedaron
 * en el enum por compatibilidad (VENCIDA / PENDIENTE, P-24) se leen como cuenta inactiva (D-27).
 */
export function estadoCuentaDe(estado: PrismaEstadoCuota): EstadoCuenta {
  if (estado === "INACTIVA") return "INACTIVA";
  if (estado === "BLOQUEADA") return "BLOQUEADA";
  if (estado === "AL_DIA") return "AL_DIA";
  return "INACTIVA";
}

/**
 * Define (o cambia) el PIN de un socio. Solo ADMINISTRADOR o RECEPCIONISTA llegan acá
 * (chequeo de rol en la ruta). El PIN se guarda hasheado y nunca se devuelve.
 *
 * @throws Error("VALIDATION_ERROR: ...") si el PIN no son 4 dígitos.
 * @throws Error("NOT_FOUND") si el socio no existe.
 */
export async function handleSetPin(socioId: string, pin: unknown): Promise<{ success: true }> {
  if (!validarPin(pin)) {
    throw new Error("VALIDATION_ERROR: El PIN debe tener exactamente 4 dígitos");
  }

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };

  const socio = (await prisma.socio.findUnique({ where: { id: socioId } })) as { id: string } | null;
  if (!socio) throw new Error("NOT_FOUND");

  const pinHash = await hashPassword(pin);
  await prisma.socio.update({ where: { id: socioId }, data: { pinHash } });

  return { success: true };
}

export interface CheckInInput {
  dni: string;
  pin: string;
  ip?: string;
  userAgent?: string;
  /** Inyectable en tests; en producción es `new Date()`. */
  ahora?: Date;
}

/** Datos del socio que puede ver la pantalla de recepción (D-43: sólo nombre y plan). */
export interface SocioAccesoDTO {
  nombre: string;
  membresia: string | null;
}

export interface CheckInResultado {
  resultado: ResultadoAcceso;
  motivo?: string;
  socio?: SocioAccesoDTO;
  estadoCuota?: EstadoCuotaSocio;
  /** `RATE_LIMITED` cuando se superó el límite de intentos por IP. */
  code?: "RATE_LIMITED";
}

function diaLimiteDelMes(ahora: Date, diaLimite: number, gracia: number): number {
  return toGymWallClock(fechaLimitePago(periodoDe(ahora), diaLimite, gracia)).getUTCDate();
}

/**
 * Check-in por DNI + PIN. Falla genérica si el DNI no existe, el socio no tiene PIN o el PIN
 * no coincide (nunca se revela cuál de los dos falló). Con identidad válida aplica `decidirAcceso`
 * y registra `Asistencia` (`metodo: DNI_PIN`) + `AuditoriaAcceso` (`CHECK_IN`).
 */
export async function handleCheckIn(input: CheckInInput): Promise<CheckInResultado> {
  const ahora = input.ahora ?? new Date();
  const ip = input.ip?.trim() || "unknown";
  const userAgent = input.userAgent?.trim() || "unknown";

  const dentroDelLimite = await checkRateLimit(ip, RATE_LIMIT_ROUTE, LIMITE_INTENTOS_CHECK_IN_POR_MINUTO);
  if (!dentroDelLimite) {
    return { resultado: "DENEGADO", motivo: MENSAJE_RATE_LIMIT, code: "RATE_LIMITED" };
  }

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };

  const socio = (await prisma.socio.findUnique({
    where: { dni: input.dni },
    include: { usuario: true, membresiaAsignada: true },
  })) as {
    id: string;
    estadoCuota: PrismaEstadoCuota;
    pinHash: string | null;
    usuario: { nombre: string } | null;
    membresiaAsignada: { nombre: string } | null;
  } | null;

  const pinValido = socio?.pinHash ? await comparePassword(input.pin, socio.pinHash) : false;

  // Identidad: DNI o PIN incorrectos → una sola respuesta genérica + auditoría (sin Asistencia:
  // no se crean ingresos para intentos de identidad fallidos).
  if (!socio || !socio.pinHash || !pinValido) {
    await prisma.auditoriaAcceso.create({
      data: {
        socioId: socio?.id ?? null,
        accion: "CHECK_IN",
        resultado: "DENY",
        motivo: MENSAJE_IDENTIDAD_INVALIDA,
        ipAddress: ip,
        userAgent,
        timestamp: ahora,
      },
    });
    return { resultado: "DENEGADO", motivo: MENSAJE_IDENTIDAD_INVALIDA };
  }

  const [ultimaCuota, config] = await Promise.all([
    prisma.cuota.findFirst({ where: { socioId: socio.id }, orderBy: { fechaVencimiento: "desc" } }),
    prisma.configuracionDelSistema.findFirst(),
  ]);

  const diaLimite = config?.diaLimitePago ?? DIA_LIMITE_PAGO_DEFAULT;
  const gracia = config?.periodoGracia ?? PERIODO_GRACIA_DEFAULT;
  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;
  const estadoCuota = estadoCuotaSocio({ ultimoPeriodoCubierto, hoy: ahora, diaLimite, gracia });

  const desde = new Date(ahora.getTime() - VENTANA_ANTI_PASSBACK_MINUTOS * 60 * 1000);
  const ingresoReciente = await prisma.asistencia.findFirst({
    where: { socioId: socio.id, estado: "PERMITIDO", fechaHora: { gte: desde } },
    orderBy: { fechaHora: "desc" },
  });

  const decision = decidirAcceso({
    estadoCuota,
    estadoCuenta: estadoCuentaDe(socio.estadoCuota),
    antiPassback: ingresoReciente !== null,
    mensajePendiente: `Cuota a pagar hasta el día ${diaLimiteDelMes(ahora, diaLimite, gracia)}`,
  });

  const permitido = decision.resultado !== "DENEGADO";

  await prisma.asistencia.create({
    data: {
      socioId: socio.id,
      fechaHora: ahora,
      estado: permitido ? "PERMITIDO" : "DENEGADO",
      razon: permitido ? null : decision.motivo ?? null,
      metodo: "DNI_PIN",
    },
  });

  await prisma.auditoriaAcceso.create({
    data: {
      socioId: socio.id,
      accion: "CHECK_IN",
      resultado: permitido ? "ALLOW" : "DENY",
      motivo: decision.motivo ?? null,
      ipAddress: ip,
      userAgent,
      timestamp: ahora,
    },
  });

  return {
    resultado: decision.resultado,
    ...(decision.motivo ? { motivo: decision.motivo } : {}),
    socio: { nombre: socio.usuario?.nombre ?? "", membresia: socio.membresiaAsignada?.nombre ?? null },
    estadoCuota,
  };
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for the kiosk page)
 * ============================================
 */

/** Authorization header con el JWT de localStorage (mismo patrón que pagos/clientes). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Client-side: check-in por DNI + PIN. */
export async function checkIn(input: { dni: string; pin: string }): Promise<CheckInResultado> {
  const response = await fetch("/api/acceso/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar el ingreso");
  return response.json();
}

/** Client-side: definir el PIN de un socio. */
export async function setPin(socioId: string, pin: string): Promise<{ success: true }> {
  const response = await fetch(`/api/socios/${socioId}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ pin }),
  });
  await throwIfNotOk(response, "No se pudo definir el PIN");
  return response.json();
}
