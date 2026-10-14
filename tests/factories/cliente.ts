import type { Cliente } from "@/domains/cliente/cliente";
import { fixedDate, nextSeq } from "./sequence";

/** Cliente del dominio: DNI normalizado (solo dígitos) y teléfono en el formato que valida el dominio. */
export function buildCliente(overrides: Partial<Cliente> = {}): Cliente {
  const n = nextSeq("cliente");
  return {
    id: `cliente-${n}`,
    nombre: `Cliente Prueba ${n}`,
    dni: String(20000000 + n),
    telefono: `+54 9 3764 ${String(100000 + n)}`,
    email: `cliente${n}@arnold.test`,
    membresiaAsignada: "membresia-1",
    estadoCuenta: "Activa",
    fechaAlta: fixedDate(),
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    ...overrides,
  };
}
