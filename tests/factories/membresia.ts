import type { Membresia } from "@/domains/membresia/membresia";
import { fixedDate, nextSeq } from "./sequence";

/** Membresía del dominio (`precio` ya es number, no Decimal). */
export function buildMembresia(overrides: Partial<Membresia> = {}): Membresia {
  const n = nextSeq("membresia");
  return {
    id: `membresia-${n}`,
    nombre: `Membresía ${n}`,
    precio: 15000,
    periodicidad: 30,
    descripcion: null,
    estado: "ACTIVA",
    createdAt: fixedDate(),
    updatedAt: fixedDate(),
    ...overrides,
  };
}
