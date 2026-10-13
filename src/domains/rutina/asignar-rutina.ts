/**
 * Asignar una rutina a un socio (T-034, RN-04). Prisma va por dentro con import
 * diferido: así el módulo puede importarse desde `src/api/rutinas-asignadas.ts`,
 * que también expone helpers de fetch del cliente.
 *
 * RN-04: un socio tiene a lo sumo UNA `RutinaAsignada` activa. Asignar una nueva
 * desactiva las anteriores dentro de la misma transacción.
 *
 * Spec: openspec/asignar-rutina-flowspec.md
 */

export interface AsignarRutinaInput {
  socioId: string;
  rutinaId: string;
}

/** Entidad que no existe al momento de asignar. `NOT_FOUND` es la señal del proyecto. */
export class EntidadNoEncontradaError extends Error {
  constructor(public readonly entidad: "Socio" | "Rutina") {
    super(
      entidad === "Rutina"
        ? "NOT_FOUND: Rutina no encontrada"
        : "NOT_FOUND: Socio no encontrado"
    );
    this.name = "EntidadNoEncontradaError";
  }
}

/**
 * Asigna una rutina a un socio. Verifica que ambos existan y, en UNA sola
 * transacción, desactiva las asignaciones activas previas del socio y crea la
 * nueva con `activa = true`. Devuelve la asignación creada con su rutina.
 *
 * @throws EntidadNoEncontradaError si el socio o la rutina no existen.
 */
export async function asignarRutina(input: AsignarRutinaInput) {
  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({ where: { id: input.socioId } });
  if (!socio) throw new EntidadNoEncontradaError("Socio");

  const rutina = await prisma.rutina.findUnique({ where: { id: input.rutinaId } });
  if (!rutina) throw new EntidadNoEncontradaError("Rutina");

  return prisma.$transaction(async (tx) => {
    await tx.rutinaAsignada.updateMany({
      where: { socioId: input.socioId, activa: true },
      data: { activa: false },
    });

    return tx.rutinaAsignada.create({
      data: { socioId: input.socioId, rutinaId: input.rutinaId, activa: true },
      include: { rutina: true },
    });
  });
}

/**
 * Asignaciones de un socio, de la más nueva a la más vieja, con la rutina incluida.
 */
export async function listarRutinasDeSocio(socioId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.rutinaAsignada.findMany({
    where: { socioId },
    include: { rutina: true },
    orderBy: { fechaAsignacion: "desc" },
  });
}
