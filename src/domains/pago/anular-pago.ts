/**
 * Anulación de un pago (P-39). Prisma va por dentro; la regla de qué pasa con la cuota es
 * explícita y no se delega en ningún proceso programado.
 *
 * Semántica decidida:
 * - El `Pago` pasa a `ANULADO` y SE CONSERVA (queda el rastro de que existió, con su monto,
 *   `montoLista` y `descuentoPct` históricos).
 * - La `Cuota` que creó ese pago se BORRA para que el sistema vuelva a pedir el período: el
 *   estado de pago se deriva de la `Cuota` (`planDePago` / `estadoCuotaSocio`), no del `Pago`,
 *   así que dejar la cuota le regalaría el mes y el portón seguiría dejando entrar al socio.
 * - Si la cuota tiene OTRO pago todavía vigente (no anulado), no se borra: la cuota sigue
 *   representando un período efectivamente pagado.
 *
 * La oferta de reactivación NO se reactiva: el pago anulado conserva su `descuentoPct`, y
 * `evaluarOfertaDeSocio` lo sigue contando para el enfriamiento
 * (ver `oferta-reactivacion-consulta.ts`).
 *
 * Spec: openspec/specs/pagos-cuotas/spec.md
 */

export interface AnularPagoInput {
  pagoId: string;
  /** Motivo obligatorio: queda en la auditoría. */
  motivo: string;
}

export interface PagoAnulado {
  pago: unknown;
  /** La cuota que se borró, o null si el pago no cubría ninguna. */
  cuotaEliminada: string | null;
}

/**
 * Conflicto cuando el pago ya estaba anulado: no se anula dos veces (P-39). El mapper lo
 * traduce a 409 `PAYMENT_ALREADY_ANNULLED`.
 */
export const PAYMENT_ALREADY_ANNULLED =
  "PAYMENT_ALREADY_ANNULLED: El pago ya está anulado";

/**
 * Anula un pago: lo pasa a `ANULADO` y borra la `Cuota` que creó (salvo que tenga otro pago
 * vigente). Corre en una transacción `Serializable`, la misma que usa el cobro.
 *
 * @throws Error("VALIDATION_ERROR: ...") si falta `pagoId` o el `motivo` está vacío.
 * @throws Error("NOT_FOUND") si el pago no existe (el route mapper lo traduce a 404).
 * @throws Error("PAYMENT_ALREADY_ANNULLED: ...") si ya estaba anulado (409).
 */
export async function anularPago(input: AnularPagoInput): Promise<PagoAnulado> {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof input.pagoId !== "string" ||
    input.pagoId.trim() === ""
  ) {
    throw new Error("VALIDATION_ERROR: El pago es requerido");
  }
  if (typeof input.motivo !== "string" || input.motivo.trim() === "") {
    throw new Error("VALIDATION_ERROR: El motivo es requerido");
  }

  const { prisma } = await import("@/lib/db");

  return prisma.$transaction(
    async (tx) => {
      const pago = await tx.pago.findUnique({
        where: { id: input.pagoId },
        include: { cuota: true },
      });
      if (!pago) throw new Error("NOT_FOUND");

      if (pago.estado === "ANULADO") {
        throw Object.assign(new Error(PAYMENT_ALREADY_ANNULLED), {
          code: "PAYMENT_ALREADY_ANNULLED",
        });
      }

      // Se conservan monto/montoLista/descuentoPct: el descuento es evidencia histórica y, junto
      // con la consulta de la oferta, es lo que impide que el descuento vuelva a estar disponible.
      const anulado = await tx.pago.update({
        where: { id: input.pagoId },
        data: { estado: "ANULADO" },
      });

      let cuotaEliminada: string | null = null;
      if (pago.cuotaId) {
        const otrosVigentes = await tx.pago.count({
          where: { cuotaId: pago.cuotaId, id: { not: pago.id }, estado: { not: "ANULADO" } },
        });
        if (otrosVigentes === 0) {
          await tx.cuota.delete({ where: { id: pago.cuotaId } });
          cuotaEliminada = pago.cuotaId;
        }
      }

      return { pago: anulado, cuotaEliminada };
    },
    { isolationLevel: "Serializable" }
  );
}
