import { cookies } from "next/headers";
import { Rol } from "@prisma/client";
import { verifyJWT } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/api/auth";
import { prisma } from "@/lib/db";
import { isTokenRevoked } from "@/lib/token-revocation";
import type { SessionUser } from "@/contexts/auth";

/**
 * Lee la cookie de sesión (solo servidor). Devuelve solo lo que el cliente necesita: nunca el hash.
 *
 * L / P-39: en páginas PÚBLICAS el proxy no corre, así que este es el único control de sesión.
 * Antes alcanzaba con verificar la firma del JWT, y por eso un token revocado o de un usuario
 * deshabilitado/borrado seguía dando un `initialUser` truthy. Ahora validamos contra la base:
 * el usuario debe existir y estar `ACTIVO` (sin `deletedAt`) y el `jti` no debe estar revocado,
 * igual que hace el proxy. Las dos consultas van en paralelo.
 *
 * Tradeoff: esto agrega ~2 lecturas por render con cookie (sin caché). Es deliberado: la
 * revocación debe ser inmediata y no queremos introducir una ventana de staleness. Sin cookie
 * no se toca la base.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const p = verifyJWT(token);
  if (!p?.rol || !p.email || !p.nombre) return null;
  if (!Object.values(Rol).includes(p.rol as Rol)) return null;

  const [user, revoked] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: p.sub }, select: { estado: true, deletedAt: true } }),
    isTokenRevoked(p.jti),
  ]);
  if (!user || user.estado !== "ACTIVO" || user.deletedAt || revoked) return null;

  return { id: p.sub, nombre: p.nombre, email: p.email, rol: p.rol as Rol };
}
