/**
 * Servicio de acceso biométrico por huella (T-041, D-43/D-47).
 *
 * El lector de la puerta compara la huella por su cuenta y manda sólo el ID de la plantilla
 * (`huellaId`). Arnold NUNCA guarda plantillas biométricas (Ley 25.326, P-30): sólo la relación
 * `socio ↔ huellaId` y una fecha de consentimiento informado.
 *
 * El enrolamiento y la baja son asincrónicos: se encolan como `SolicitudDeHuella` PENDIENTE y el
 * sensor las levanta por polling, confirmando luego el resultado. Prisma se importa en forma
 * diferida (este módulo también puede llegar al navegador vía tipos compartidos).
 */
import {
  evaluarYRegistrarAcceso,
  type PrismaLike as AccesoPrismaLike,
  type SocioParaAcceso,
} from "@/api/acceso";
import { elegirHuellaIdLibre, HUELLA_CONFIANZA_MINIMA } from "@/domains/acceso/huella";

type AccionHuella = "ENROLAR" | "BORRAR";
type EstadoSolicitud = "PENDIENTE" | "CONFIRMADA" | "FALLIDA";

/** Acción tal como la entiende el sensor (minúsculas) en el polling y la confirmación. */
export type AccionHuellaDispositivo = "enrolar" | "borrar";

interface SolicitudRow {
  id: string;
  socioId: string;
  accion: AccionHuella;
  huellaId: number;
  estado: EstadoSolicitud;
  motivo: string | null;
  duplicadoDe: number | null;
  createdAt: Date;
  resueltaEn: Date | null;
}

interface SocioRow {
  id: string;
  huellaId: number | null;
  huellaConsentimientoEn?: Date | null;
}

interface SocioAccesoRow extends SocioParaAcceso {
  huellaId?: number | null;
}

/** Lo que el sensor recibe al levantar la cola de solicitudes. */
export interface SolicitudPendienteDTO {
  accion: AccionHuellaDispositivo | null;
  huellaId?: number;
}

/** Estado de la huella para el panel de administración. */
export interface EstadoHuellaDTO {
  huellaId: number | null;
  consentimientoEn: Date | null;
  solicitud: Omit<SolicitudRow, "socioId"> | null;
}

export interface ConfirmarSolicitudInput {
  huellaId: number;
  accion: AccionHuellaDispositivo;
  ok: boolean;
  motivo?: string | null;
  duplicadoDe?: number | null;
}

export interface ConfirmarSolicitudResultado {
  ok: boolean;
  motivo?: string;
}

export interface AccesoPorHuellaInput {
  huellaId: number;
  confianza: number;
  ip: string;
  userAgent: string;
  /** Inyectable en tests; en producción es `new Date()`. */
  ahora?: Date;
}

export interface AccesoPorHuellaResultado {
  autorizado: boolean;
  nombre?: string;
  motivo?: string;
}

interface PrismaLike extends AccesoPrismaLike {
  socio: {
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  solicitudDeHuella: {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<unknown>;
  };
}

async function getPrisma(): Promise<PrismaLike> {
  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };
  return prisma;
}

/**
 * Encola un enrolamiento de huella para el socio.
 *
 * Exige consentimiento informado (Ley 25.326), elige un `huellaId` libre reservando tanto las
 * huellas ya asignadas como las solicitudes PENDIENTES, marca FALLIDA cualquier solicitud PENDIENTE
 * previa del socio (motivo "reemplazada") y sella la fecha de consentimiento.
 *
 * @throws Error("NOT_FOUND: ...") si el socio no existe.
 * @throws Error("VALIDATION_ERROR: ...") sin consentimiento o si el sensor está lleno.
 */
export async function solicitarEnrolamiento(
  socioId: string,
  { consentimiento }: { consentimiento: unknown }
): Promise<Omit<SolicitudRow, "socioId">> {
  if (!consentimiento) {
    throw new Error("VALIDATION_ERROR: Se requiere consentimiento informado para registrar la huella");
  }

  const prisma = await getPrisma();
  const ahora = new Date();

  const socio = (await prisma.socio.findUnique({ where: { id: socioId } })) as SocioRow | null;
  if (!socio) throw new Error("NOT_FOUND: Socio no encontrado");

  // IDs reservados: los ya asignados a un socio + los que tienen solicitudes PENDIENTES
  // (aún no confirmadas en el sensor). Evita que dos enrolamientos en curso usen el mismo ID.
  // shortcut: la reserva no es transaccional (lectura + create separados); dos enrolamientos
  // simultáneos podrían compartir un ID PENDIENTE. El @unique de Socio.huellaId lo atrapa al
  // confirmar. Alcanza con un solo sensor y disparo manual; envolver en transacción si se
  // agregan lectores o enrolamiento masivo.
  const [sociosConHuella, pendientes] = await Promise.all([
    prisma.socio.findMany({ where: { huellaId: { not: null } }, select: { huellaId: true } }),
    prisma.solicitudDeHuella.findMany({ where: { estado: "PENDIENTE" }, select: { huellaId: true } }),
  ]);
  const idsUsados = [
    ...(sociosConHuella as { huellaId: number | null }[])
      .map((s) => s.huellaId)
      .filter((id): id is number => id !== null),
    ...(pendientes as { huellaId: number }[]).map((s) => s.huellaId),
  ];

  const huellaId = elegirHuellaIdLibre(idsUsados);
  if (huellaId === null) {
    throw new Error("VALIDATION_ERROR: No hay IDs de huella libres");
  }

  await prisma.solicitudDeHuella.updateMany({
    where: { socioId, estado: "PENDIENTE" },
    data: { estado: "FALLIDA", motivo: "reemplazada", resueltaEn: ahora },
  });
  await prisma.socio.update({
    where: { id: socioId },
    data: { huellaConsentimientoEn: ahora },
  });

  const solicitud = (await prisma.solicitudDeHuella.create({
    data: { socioId, accion: "ENROLAR", huellaId, estado: "PENDIENTE" },
  })) as SolicitudRow;

  return sinSocioId(solicitud);
}

/**
 * Encola la baja de la huella del socio con su `huellaId` actual.
 *
 * @throws Error("NOT_FOUND: ...") si el socio no existe.
 * @throws Error("VALIDATION_ERROR: ...") si el socio no tiene huella registrada.
 */
export async function solicitarBaja(socioId: string): Promise<Omit<SolicitudRow, "socioId">> {
  const prisma = await getPrisma();

  const socio = (await prisma.socio.findUnique({ where: { id: socioId } })) as SocioRow | null;
  if (!socio) throw new Error("NOT_FOUND: Socio no encontrado");
  if (socio.huellaId === null || socio.huellaId === undefined) {
    throw new Error("VALIDATION_ERROR: El socio no tiene huella registrada");
  }

  const solicitud = (await prisma.solicitudDeHuella.create({
    data: { socioId, accion: "BORRAR", huellaId: socio.huellaId, estado: "PENDIENTE" },
  })) as SolicitudRow;

  return sinSocioId(solicitud);
}

/**
 * Estado de la huella del socio y su solicitud más reciente (para el panel de administración).
 *
 * @throws Error("NOT_FOUND: ...") si el socio no existe.
 */
export async function estadoHuella(socioId: string): Promise<EstadoHuellaDTO> {
  const prisma = await getPrisma();

  const socio = (await prisma.socio.findUnique({ where: { id: socioId } })) as SocioRow | null;
  if (!socio) throw new Error("NOT_FOUND: Socio no encontrado");

  const solicitud = (await prisma.solicitudDeHuella.findFirst({
    where: { socioId },
    orderBy: { createdAt: "desc" },
  })) as SolicitudRow | null;

  return {
    huellaId: socio.huellaId ?? null,
    consentimientoEn: socio.huellaConsentimientoEn ?? null,
    solicitud: solicitud ? sinSocioId(solicitud) : null,
  };
}

/**
 * La solicitud PENDIENTE más antigua, para que el sensor la ejecute por polling. `accion: null`
 * cuando no hay nada pendiente.
 */
export async function tomarSolicitudPendiente(): Promise<SolicitudPendienteDTO> {
  const prisma = await getPrisma();

  const solicitud = (await prisma.solicitudDeHuella.findFirst({
    where: { estado: "PENDIENTE" },
    orderBy: { createdAt: "asc" },
  })) as SolicitudRow | null;

  if (!solicitud) return { accion: null };
  return {
    accion: solicitud.accion === "ENROLAR" ? "enrolar" : "borrar",
    huellaId: solicitud.huellaId,
  };
}

/**
 * Confirma ante Arnold el resultado que reportó el sensor. Marca la solicitud CONFIRMADA o FALLIDA
 * y, en los éxitos, actualiza `Socio.huellaId` (alta al enrolar, `null` al borrar).
 *
 * Idempotente-ish: si no hay una solicitud PENDIENTE que corresponda a `{huellaId, accion}`, no
 * rompe: devuelve `{ ok: false, motivo: "sin_solicitud_pendiente" }`.
 */
export async function confirmarSolicitud(
  input: ConfirmarSolicitudInput
): Promise<ConfirmarSolicitudResultado> {
  const prisma = await getPrisma();
  const ahora = new Date();
  const accion: AccionHuella = input.accion === "enrolar" ? "ENROLAR" : "BORRAR";

  const solicitud = (await prisma.solicitudDeHuella.findFirst({
    where: { huellaId: input.huellaId, accion, estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
  })) as SolicitudRow | null;

  if (!solicitud) {
    return { ok: false, motivo: "sin_solicitud_pendiente" };
  }

  const data: Record<string, unknown> = {
    estado: input.ok ? "CONFIRMADA" : "FALLIDA",
    motivo: input.motivo ?? null,
    resueltaEn: ahora,
  };
  if (input.duplicadoDe !== undefined && input.duplicadoDe !== null) {
    data.duplicadoDe = input.duplicadoDe;
  }

  await prisma.solicitudDeHuella.update({ where: { id: solicitud.id }, data });

  if (input.ok) {
    await prisma.socio.update({
      where: { id: solicitud.socioId },
      data: { huellaId: accion === "ENROLAR" ? solicitud.huellaId : null },
    });
    return { ok: true };
  }

  return { ok: false, motivo: input.motivo ?? "fallida" };
}

/**
 * Acceso por huella (D-47). El sensor manda el `huellaId` y su `confianza` (0..100). Los intentos
 * no reconocidos o con confianza insuficiente se auditan como DENY sin evaluar la cuota; el resto
 * reutiliza `evaluarYRegistrarAcceso` con `metodo: HUELLA`.
 */
export async function handleAccesoPorHuella(
  input: AccesoPorHuellaInput
): Promise<AccesoPorHuellaResultado> {
  const prisma = await getPrisma();
  const ahora = input.ahora ?? new Date();

  const socio = (await prisma.socio.findUnique({
    where: { huellaId: input.huellaId },
    include: { usuario: true, membresiaAsignada: true },
  })) as SocioAccesoRow | null;

  if (!socio) {
    await auditarDeny(prisma, null, "Huella no reconocida", input.ip, input.userAgent, ahora);
    return { autorizado: false, motivo: "Huella no reconocida" };
  }

  if (input.confianza < HUELLA_CONFIANZA_MINIMA) {
    await auditarDeny(prisma, socio.id, "Confianza insuficiente", input.ip, input.userAgent, ahora);
    return { autorizado: false, motivo: "Confianza insuficiente" };
  }

  const resultado = await evaluarYRegistrarAcceso(prisma, socio, {
    ip: input.ip,
    userAgent: input.userAgent,
    metodo: "HUELLA",
    ahora,
  });

  return {
    autorizado: resultado.resultado !== "DENEGADO",
    ...(resultado.socio?.nombre ? { nombre: resultado.socio.nombre } : {}),
    ...(resultado.motivo ? { motivo: resultado.motivo } : {}),
  };
}

/** Auditoría DENY de un intento por huella que no llega a evaluar cuota (sin Asistencia). */
async function auditarDeny(
  prisma: PrismaLike,
  socioId: string | null,
  motivo: string,
  ip: string,
  userAgent: string,
  ahora: Date
): Promise<void> {
  await prisma.auditoriaAcceso.create({
    data: {
      socioId,
      accion: "CHECK_IN",
      resultado: "DENY",
      motivo,
      ipAddress: ip,
      userAgent,
      timestamp: ahora,
    },
  });
}

function sinSocioId(solicitud: SolicitudRow): Omit<SolicitudRow, "socioId"> {
  return {
    id: solicitud.id,
    accion: solicitud.accion,
    huellaId: solicitud.huellaId,
    estado: solicitud.estado,
    motivo: solicitud.motivo,
    duplicadoDe: solicitud.duplicadoDe,
    createdAt: solicitud.createdAt,
    resueltaEn: solicitud.resueltaEn,
  };
}
