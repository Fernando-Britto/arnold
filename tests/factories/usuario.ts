import { EstadoUsuario, Rol, type Usuario } from "@prisma/client";
import { fixedDate, nextSeq } from "./sequence";

/**
 * Fila de Usuario. `password` es un texto fijo que NO es un hash válido a propósito:
 * si un test necesita iniciar sesión de verdad, que genere el hash con `hashPassword`.
 */
export function buildUsuario(overrides: Partial<Usuario> = {}): Usuario {
  const n = nextSeq("usuario");
  return {
    id: `usuario-${n}`,
    nombre: `Usuario Prueba ${n}`,
    email: `usuario${n}@arnold.test`,
    password: "hash-de-prueba",
    rol: Rol.SOCIO,
    estado: EstadoUsuario.ACTIVO,
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    deletedAt: null,
    ...overrides,
  };
}
