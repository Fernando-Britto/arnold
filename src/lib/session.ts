import { cookies } from "next/headers";
import { Rol } from "@prisma/client";
import { verifyJWT } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/api/auth";
import type { SessionUser } from "@/contexts/auth";

/** Lee la cookie de sesión (solo servidor). Devuelve solo lo que el cliente necesita: nunca el hash. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const p = verifyJWT(token);
  if (!p?.rol || !p.email || !p.nombre) return null;
  if (!Object.values(Rol).includes(p.rol as Rol)) return null;
  return { id: p.sub, nombre: p.nombre, email: p.email, rol: p.rol as Rol };
}
