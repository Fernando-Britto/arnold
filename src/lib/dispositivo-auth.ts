/**
 * Autenticación de dispositivos (T-036, D-43 propuesta 4).
 *
 * La tablet de la puerta y, más adelante, el controlador del molinete no usan sesión de usuario:
 * se identifican con un token propio. El token viaja en el header `x-dispositivo-token`
 * (o `Authorization: Bearer <token>`) y se compara contra el hash bcrypt guardado. El token en
 * claro nunca se persiste: sólo se devuelve una vez al provisionar.
 */
import bcryptjs from "bcryptjs";
import { randomBytes } from "crypto";

export const DISPOSITIVO_TOKEN_HEADER = "x-dispositivo-token";
/** 32 bytes de entropía → token base64url de 43 caracteres. */
export const TOKEN_DISPOSITIVO_BYTES = 32;
/** Largo del prefijo guardado como selector (AC-7). */
export const TOKEN_PREFIX_LENGTH = 8;

/** Token de dispositivo nuevo, de alta entropía. */
export function generarTokenDispositivo(): string {
  return randomBytes(TOKEN_DISPOSITIVO_BYTES).toString("base64url");
}

/** Prefijo índice del token (no es secreto por sí solo). */
export function prefijoDeToken(token: string): string {
  return token.slice(0, TOKEN_PREFIX_LENGTH);
}

export interface RequestLike {
  headers: { get(name: string): string | null };
}

/**
 * Token de dispositivo de la petición. Prioriza el header propio; acepta `Authorization: Bearer`
 * como alternativa. Devuelve null si no hay credencial utilizable.
 */
export function tokenDeDispositivo(request: RequestLike): string | null {
  const directo = request.headers.get(DISPOSITIVO_TOKEN_HEADER)?.trim();
  if (directo) return directo;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

/**
 * Primer dispositivo cuyo hash coincida con el token. Los hashes bcrypt son salados: no se puede
 * buscar por igualdad. Con AC-7 la lista recibida ya viene filtrada por el prefijo del token, así
 * que se compara contra muy pocos candidatos (idealmente uno).
 */
export async function encontrarDispositivoPorToken<T extends { tokenHash: string }>(
  token: string,
  dispositivos: T[]
): Promise<T | null> {
  for (const dispositivo of dispositivos) {
    if (await bcryptjs.compare(token, dispositivo.tokenHash)) return dispositivo;
  }
  return null;
}

export interface DispositivoRow {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  tokenHash: string;
  /** AC-7: prefijo índice; null en dispositivos provisionados antes de la columna. */
  tokenPrefix?: string | null;
  ultimoContacto: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaLike {
  dispositivo: {
    findMany(args: unknown): Promise<DispositivoRow[]>;
    update(args: unknown): Promise<unknown>;
  };
}

/**
 * Autentica el dispositivo de la petición. Solo considera dispositivos `ACTIVO` y, al validar,
 * actualiza `ultimoContacto`. Devuelve el dispositivo o null (petición no autenticada).
 *
 * AC-7: en vez de cargar TODOS los activos y comparar bcrypt uno a uno (O(n)), se busca por el
 * prefijo indexado del token (primeros 8 chars) y sólo se compara bcrypt contra ese candidato.
 */
export async function autenticarDispositivo(request: RequestLike): Promise<DispositivoRow | null> {
  const token = tokenDeDispositivo(request);
  if (!token) return null;

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };

  // AC-7: camino rápido, primero el candidato por el prefijo indexado.
  const candidatos = await prisma.dispositivo.findMany({
    where: { tokenPrefix: prefijoDeToken(token), estado: "ACTIVO" },
  });
  let dispositivo = await encontrarDispositivoPorToken(token, candidatos);

  // AC-12 (compatibilidad): los dispositivos provisionados antes de la columna `tokenPrefix`
  // quedaron con NULL, y NULL nunca iguala un prefijo real, así que sin este fallback jamás
  // podrían autenticarse. No hay backfill posible (el prefijo se deriva del token en claro, que
  // no se persiste). Se compara bcrypt sólo contra esas filas legacy. Se puede eliminar cuando no
  // queden dispositivos con `tokenPrefix = null` (o tras un re-provisionamiento).
  if (!dispositivo) {
    const legacy = await prisma.dispositivo.findMany({
      where: { tokenPrefix: null, estado: "ACTIVO" },
    });
    dispositivo = await encontrarDispositivoPorToken(token, legacy);
  }

  if (!dispositivo || dispositivo.estado !== "ACTIVO") return null;

  await prisma.dispositivo.update({
    where: { id: dispositivo.id },
    data: { ultimoContacto: new Date() },
  });

  return dispositivo;
}
