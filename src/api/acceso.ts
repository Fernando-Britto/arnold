/**
 * Servicio de acceso al gimnasio (T-035, D-47):
 *  - definir el PIN de 4 dígitos de un socio (recepción, primera vez),
 *  - check-in por DNI + PIN con la decisión pura de `src/domains/acceso/check-in.ts`.
 *
 * D-46: la cuenta (`Socio.estadoCuota`) se separa del pago calculado (`estadoCuotaSocio`, D-40).
 * Prisma se importa en forma diferida: este módulo también expone helpers de fetch para el cliente.
 */
import type { EstadoCuota as PrismaEstadoCuota, MetodoIdentificacion } from "@prisma/client";
import {
  estadoCuotaSocio,
  fechaLimitePago,
  periodoDe,
  type EstadoCuotaSocio,
} from "@/domains/pago/cuota";
import {
  decidirAcceso,
  type EstadoCuenta,
  type ResultadoAcceso,
} from "@/domains/acceso/check-in";
import { validarPin } from "@/domains/acceso/pin";
import { normalizeDNI } from "@/domains/cliente/cliente";
import { hashPassword, comparePassword } from "@/lib/auth";
import { isRateLimited, recordRateLimitHit } from "@/lib/rateLimit";
import { toGymWallClock } from "@/lib/gym-time";
import { CONFIGURACION_POR_DEFECTO, getConfiguracion, type ConfiguracionReader } from "@/lib/configuracion";
import { throwIfNotOk } from "@/utils/api-error";

/** Ventana de anti-passback por defecto (P-33): configurable vía `ConfiguracionDelSistema.antiPassbackMinutos`. */
export const VENTANA_ANTI_PASSBACK_MINUTOS = CONFIGURACION_POR_DEFECTO.antiPassbackMinutos;
/** Intentos de check-in por IP y minuto (reutiliza `rateLimit`, como el login). */
export const LIMITE_INTENTOS_CHECK_IN_POR_MINUTO = 20;
const RATE_LIMIT_ROUTE = "acceso:check-in";
/** Mensaje único para DNI o PIN incorrectos: no se revela cuál de los dos falló. */
export const MENSAJE_IDENTIDAD_INVALIDA = "DNI o PIN incorrectos";
export const MENSAJE_RATE_LIMIT = "Demasiados intentos. Probá de nuevo en un minuto.";

/** PIN válido: exactamente 4 dígitos (se permiten ceros a la izquierda). Definido en el dominio. */
export { validarPin };

export interface PrismaLike extends ConfiguracionReader {
  socio: {
    findUnique(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  cuota: { findFirst(args: unknown): Promise<{ fechaVencimiento: Date } | null> };
  asistencia: {
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  auditoriaAcceso: { create(args: unknown): Promise<unknown> };
  /** Transacción interactiva: `tx` expone los mismos modelos que el cliente. */
  $transaction<R>(fn: (tx: PrismaLike) => Promise<R>): Promise<R>;
}

/**
 * Estado de la cuenta a partir de `Socio.estadoCuota` (D-46, P-24). El enum sólo tiene estados
 * de CUENTA: `AL_DIA` (habilitada), `INACTIVA` (dada de baja/pausa) y `BLOQUEADA` (sanción).
 * El estado de pago no vive acá: se calcula con `estadoCuotaSocio` (D-40).
 */
export function estadoCuentaDe(estado: PrismaEstadoCuota): EstadoCuenta {
  switch (estado) {
    case "AL_DIA":
      return "AL_DIA";
    case "INACTIVA":
      return "INACTIVA";
    case "BLOQUEADA":
      return "BLOQUEADA";
  }
}

/**
 * Ventana efectiva de anti-passback (P-33): usa la configurada por el sistema si es un entero
 * positivo; si falta o es inválida (cero, negativa o no entera), cae al default del código.
 */
export function ventanaAntiPassbackMinutos(
  config: { antiPassbackMinutos?: number | null } | null | undefined
): number {
  const configurado = config?.antiPassbackMinutos;
  return typeof configurado === "number" && Number.isInteger(configurado) && configurado > 0
    ? configurado
    : VENTANA_ANTI_PASSBACK_MINUTOS;
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

/**
 * Datos del socio que puede ver la pantalla de recepción (D-43: sólo nombre y plan).
 * `id` viaja para que recepción pueda dirigir una autorización excepcional (AC-3) al socio.
 */
export interface SocioAccesoDTO {
  id: string;
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
 * Socio mínimo que necesita la evaluación de acceso. Lo comparten el check-in por DNI+PIN y el
 * acceso por huella: en ambos casos la identidad ya se resolvió antes de llegar acá.
 */
export interface SocioParaAcceso {
  id: string;
  estadoCuota: PrismaEstadoCuota;
  usuario: { nombre: string } | null;
  membresiaAsignada: { nombre: string } | null;
}

export interface EvaluarAccesoInput {
  ip: string;
  userAgent: string;
  metodo: MetodoIdentificacion;
  ahora: Date;
}

/**
 * Parte común posterior a la identidad (D-47): calcula el estado de pago, aplica el anti-passback,
 * decide con `decidirAcceso` y persiste `Asistencia` (con `metodo`) + `AuditoriaAcceso` (`CHECK_IN`)
 * en UNA transacción. Lo usan el check-in por DNI+PIN (`metodo: DNI_PIN`) y el acceso por huella
 * (`metodo: HUELLA`).
 */
export async function evaluarYRegistrarAcceso(
  prisma: PrismaLike,
  socio: SocioParaAcceso,
  { ip, userAgent, metodo, ahora }: EvaluarAccesoInput
): Promise<CheckInResultado> {
  const [ultimaCuota, config] = await Promise.all([
    prisma.cuota.findFirst({ where: { socioId: socio.id }, orderBy: { fechaVencimiento: "desc" } }),
    getConfiguracion(prisma),
  ]);

  const { diaLimitePago: diaLimite, periodoGracia: gracia } = config;
  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;
  const estadoCuota = estadoCuotaSocio({ ultimoPeriodoCubierto, hoy: ahora, diaLimite, gracia });

  const desde = new Date(
    ahora.getTime() - ventanaAntiPassbackMinutos(config) * 60 * 1000
  );
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

  // AC-2: el ingreso (`Asistencia`) y su auditoría son un único estado acoplado.
  // Van en UNA transacción: nunca queda un ingreso sin su rastro obligatorio
  // (ni una auditoría de un ingreso que no se persistió).
  await prisma.$transaction(async (tx) => {
    await tx.asistencia.create({
      data: {
        socioId: socio.id,
        fechaHora: ahora,
        estado: permitido ? "PERMITIDO" : "DENEGADO",
        razon: permitido ? null : decision.motivo ?? null,
        metodo,
      },
    });

    await tx.auditoriaAcceso.create({
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
  });

  return {
    resultado: decision.resultado,
    ...(decision.motivo ? { motivo: decision.motivo } : {}),
    socio: {
      id: socio.id,
      nombre: socio.usuario?.nombre ?? "",
      membresia: socio.membresiaAsignada?.nombre ?? null,
    },
    estadoCuota,
  };
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

  // El presupuesto cuenta SÓLO intentos de identidad fallidos (fuerza bruta). Un check-in
  // exitoso (permitido o denegado por regla de negocio) no consume el límite.
  if (await isRateLimited(ip, RATE_LIMIT_ROUTE, LIMITE_INTENTOS_CHECK_IN_POR_MINUTO)) {
    return { resultado: "DENEGADO", motivo: MENSAJE_RATE_LIMIT, code: "RATE_LIMITED" };
  }

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };

  // AC-9: el DNI se guarda normalizado (solo dígitos, `normalizeDNI` en el alta). El check-in
  // normaliza igual antes de buscar, así "30.123.456" encuentra al mismo socio que "30123456"
  // (el kiosco usa teclado numérico y manda sólo dígitos, pero otros clientes pueden mandar puntos).
  const socio = (await prisma.socio.findUnique({
    where: { dni: normalizeDNI(input.dni) },
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
    // Único punto que consume el presupuesto anti fuerza bruta por IP.
    await recordRateLimitHit(ip, RATE_LIMIT_ROUTE);
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

  return evaluarYRegistrarAcceso(prisma, socio, {
    ip,
    userAgent,
    metodo: "DNI_PIN",
    ahora,
  });
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for the kiosk page)
 * ============================================
 */

/**
 * Client-side fetches: la sesión viaja en la cookie (HttpOnly); el cliente no adjunta
 * headers de auth (PG-7).
 */

/** Client-side: check-in por DNI + PIN. */
export async function checkIn(input: { dni: string; pin: string }): Promise<CheckInResultado> {
  const response = await fetch("/api/acceso/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar el ingreso");
  return response.json();
}

/** Client-side: definir el PIN de un socio. */
export async function setPin(socioId: string, pin: string): Promise<{ success: true }> {
  const response = await fetch(`/api/socios/${socioId}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  await throwIfNotOk(response, "No se pudo definir el PIN");
  return response.json();
}
