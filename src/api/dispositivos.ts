/**
 * Servicio de dispositivos (T-036, D-43 propuesta 4).
 *
 * Alta de un dispositivo con token en claro devuelto UNA sola vez (mismo patrón que `tempPassword`
 * de clientes): en la base sólo queda el hash. El listado nunca expone el token ni su hash.
 * También expone el fetch cliente del check-in de puerta.
 */
import type { ResultadoAcceso } from "@/domains/acceso/check-in";
import { hashPassword } from "@/lib/auth";
import { generarTokenDispositivo } from "@/lib/dispositivo-auth";
import { throwIfNotOk } from "@/utils/api-error";

const TIPOS_DISPOSITIVO = ["PUERTA", "RECEPCION"] as const;
export type TipoDispositivo = (typeof TIPOS_DISPOSITIVO)[number];

/** Datos del dispositivo visibles en la API (sin token ni hash). */
export interface DispositivoDTO {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  ultimoContacto: Date | null;
  createdAt: Date;
}

export interface CrearDispositivoInput {
  nombre: unknown;
  tipo?: unknown;
}

export interface CrearDispositivoResult {
  dispositivo: DispositivoDTO;
  /** Token en claro. Se devuelve UNA sola vez; después no hay forma de recuperarlo. */
  token: string;
}

interface DispositivoRaw {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  ultimoContacto: Date | null;
  createdAt: Date;
}

interface PrismaLike {
  dispositivo: {
    create(args: unknown): Promise<DispositivoRaw>;
    findMany(args: unknown): Promise<DispositivoRaw[]>;
  };
}

/** Recorta una fila a los campos públicos: el token y su hash nunca salen. */
function aDTO(row: DispositivoRaw): DispositivoDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    estado: row.estado,
    ultimoContacto: row.ultimoContacto,
    createdAt: row.createdAt,
  };
}

function validarTipo(tipo: unknown): TipoDispositivo {
  if (tipo === undefined) return "PUERTA";
  if (typeof tipo === "string" && (TIPOS_DISPOSITIVO as readonly string[]).includes(tipo)) {
    return tipo as TipoDispositivo;
  }
  throw new Error("VALIDATION_ERROR: Tipo de dispositivo inválido");
}

/**
 * Crea un dispositivo y devuelve su token en claro una única vez.
 *
 * @throws Error("VALIDATION_ERROR: ...") si el nombre está vacío o el tipo es inválido.
 */
export async function handleDispositivoCreate(
  input: CrearDispositivoInput
): Promise<CrearDispositivoResult> {
  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  if (!nombre) {
    throw new Error("VALIDATION_ERROR: El nombre del dispositivo es obligatorio");
  }
  const tipo = validarTipo(input.tipo);

  const token = generarTokenDispositivo();
  const tokenHash = await hashPassword(token);

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };
  const creado = await prisma.dispositivo.create({
    data: { nombre, tipo, tokenHash },
  });

  return { dispositivo: aDTO(creado), token };
}

/** Lista los dispositivos sin token ni hash, del más nuevo al más viejo. */
export async function handleDispositivoList(): Promise<DispositivoDTO[]> {
  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };
  const filas = await prisma.dispositivo.findMany({ orderBy: { createdAt: "desc" } });
  return filas.map(aDTO);
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for the door page)
 * ============================================
 */

/** Respuesta mínima de la puerta (D-43): estado + nombre; nunca plan ni pago. */
export interface AccesoPuertaRespuesta {
  resultado: ResultadoAcceso;
  motivo?: string;
  nombre?: string;
}

/** Client-side: check-in de la puerta con el token del dispositivo. */
export async function accesoDispositivo(
  input: { dni: string; pin: string },
  token: string
): Promise<AccesoPuertaRespuesta> {
  const response = await fetch("/api/dispositivo/acceso", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dispositivo-token": token },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar el ingreso");
  return response.json();
}
