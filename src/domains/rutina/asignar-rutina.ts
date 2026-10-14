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
 * NF-5: el socio (o su `Usuario`) no está habilitado para entrenar, así que no se
 * le puede asignar una rutina. `VALIDATION_*` hace que el mapper lo devuelva como
 * 400, nunca como un éxito silencioso.
 */
export class SocioInactivoError extends Error {
  constructor() {
    super("VALIDATION_SOCIO_INACTIVO: El socio debe estar activo para asignar rutina");
    this.name = "SocioInactivoError";
  }
}

/**
 * NF-12: dos asignaciones concurrentes al mismo socio chocaron bajo aislamiento
 * Serializable (`P2034`). Es un conflicto recuperable (reintentar), no un 500.
 */
export class AsignacionConflictoError extends Error {
  constructor() {
    super(
      "ASIGNACION_CONFLICTO: Otra asignación de rutina se procesó al mismo tiempo; vuelva a intentarlo"
    );
    this.name = "AsignacionConflictoError";
  }
}

/**
 * Asigna una rutina a un socio. Verifica que ambos existan, que el socio esté
 * ACTIVO (NF-5) y, en UNA sola transacción Serializable (NF-12), desactiva las
 * asignaciones activas previas del socio y crea la nueva con `activa = true`.
 * Devuelve la asignación creada con su rutina.
 *
 * @throws EntidadNoEncontradaError si el socio o la rutina no existen.
 * @throws SocioInactivoError si el socio no está ACTIVO o tiene `deletedAt`.
 * @throws AsignacionConflictoError si la transacción falla por `P2034`.
 */
export async function asignarRutina(input: AsignarRutinaInput) {
  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({
    where: { id: input.socioId },
    include: { usuario: { select: { estado: true, deletedAt: true } } },
  });
  if (!socio) throw new EntidadNoEncontradaError("Socio");

  // NF-5: no se asigna rutina a un socio inactivo o dado de baja.
  if (socio.usuario?.estado !== "ACTIVO" || socio.usuario.deletedAt) {
    throw new SocioInactivoError();
  }

  const rutina = await prisma.rutina.findUnique({ where: { id: input.rutinaId } });
  if (!rutina) throw new EntidadNoEncontradaError("Rutina");

  try {
    // NF-12: RN-04 se enforcea en la app (RN-04 sin partial unique index). Bajo el
    // aislamiento por defecto, dos asignaciones concurrentes podrían ambas dejar una
    // `activa`. Serializable las ordena: la que pierde falla con `P2034` → conflicto.
    return await prisma.$transaction(
      async (tx) => {
        await tx.rutinaAsignada.updateMany({
          where: { socioId: input.socioId, activa: true },
          data: { activa: false },
        });

        return tx.rutinaAsignada.create({
          data: { socioId: input.socioId, rutinaId: input.rutinaId, activa: true },
          include: { rutina: true },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "P2034") {
      throw new AsignacionConflictoError();
    }
    throw error;
  }
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
