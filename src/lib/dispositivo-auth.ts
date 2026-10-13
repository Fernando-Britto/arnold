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

/** Token de dispositivo nuevo, de alta entropía. */
export function generarTokenDispositivo(): string {
  return randomBytes(TOKEN_DISPOSITIVO_BYTES).toString("base64url");
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
 * buscar por igualdad, se comparan uno a uno (la cantidad de dispositivos es chica).
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
 */
export async function autenticarDispositivo(request: RequestLike): Promise<DispositivoRow | null> {
  const token = tokenDeDispositivo(request);
  if (!token) return null;

  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: PrismaLike };

  const activos = await prisma.dispositivo.findMany({ where: { estado: "ACTIVO" } });
  const dispositivo = await encontrarDispositivoPorToken(token, activos);
  if (!dispositivo || dispositivo.estado !== "ACTIVO") return null;

  await prisma.dispositivo.update({
    where: { id: dispositivo.id },
    data: { ultimoContacto: new Date() },
  });

  return dispositivo;
}
