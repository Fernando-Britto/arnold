/**
 * Registro de un pago mensual (T-032, D-40, D-46). Prisma va por dentro; la lógica de
 * cuotas sale de `./cuota` (funciones puras).
 *
 * D-46: `Socio.estadoCuota` es el estado de la CUENTA (AL_DIA / INACTIVA / BLOQUEADA) y
 * este flujo NUNCA lo escribe. El estado de pago se calcula con `estadoCuotaSocio` y no se
 * persiste: `Cuota` + `Pago` son la única fuente de verdad del pago.
 *
 * Spec: openspec/specs/pagos-cuotas/spec.md
 */
import type { MetodoPago as PrismaMetodoPago } from "@prisma/client";
import {
  estadoCuotaSocio,
  periodoDe,
  planDePago,
  type EstadoCuotaSocio,
  type PlanDePago,
} from "./cuota";

export const METODOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "TARJETA"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

/** Conflicto cuando ya existe una cuota para el período que se intenta pagar (PG-4). */
export const PAYMENT_ALREADY_REGISTERED =
  "PAYMENT_ALREADY_REGISTERED: Ya existe una cuota para el período que se intenta pagar";

/** Defaults de `ConfiguracionDelSistema` cuando todavía no existe la fila (D-40). */
export const DIA_LIMITE_PAGO_DEFAULT = 10;
export const DIA_CORTE_ALTA_TARDIA_DEFAULT = 20;
export const PERIODO_GRACIA_DEFAULT = 0;

export interface RegistrarPagoInput {
  socioId: string;
  /** Se valida en runtime: un valor fuera de `METODOS_PAGO` es un error de validación. */
  metodoPago: string;
  fechaPago?: Date;
  hoy?: Date;
}

export interface PagoRegistrado {
  pago: unknown;
  cuota: unknown;
  plan: PlanDePago;
  estadoCuota: EstadoCuotaSocio;
}

function esMetodoValido(metodo: string): metodo is MetodoPago {
  return (METODOS_PAGO as readonly string[]).includes(metodo);
}

/**
 * Registra el pago de un socio: calcula el plan (alta con prorrateo, alta completa o
 * renovación), crea `Cuota` + `Pago` en UNA transacción y devuelve el estado de pago
 * resultante. No escribe `Socio.estadoCuota`.
 *
 * El monto NUNCA lo fija el cliente: se usa siempre `plan.monto`, porque un pago cubre
 * una cuota completa (D-40). Aceptar un monto arbitrario permitiría crear cuotas gratis
 * o subvaluadas (PG-2).
 *
 * @throws Error("VALIDATION_ERROR: El socio es requerido") si falta `socioId` o el input no es un objeto.
 * @throws Error("VALIDATION_ERROR: ...") si el método de pago es inválido o el socio no tiene membresía.
 * @throws Error("NOT_FOUND") si el socio no existe (el route mapper lo traduce a 404).
 * @throws Error("PAYMENT_ALREADY_REGISTERED: ...") si ya hay una cuota para el período objetivo
 *   (PG-4, anti doble-cobro; el route mapper lo traduce a 409).
 */
export async function registrarPago(input: RegistrarPagoInput): Promise<PagoRegistrado> {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof input.socioId !== "string" ||
    input.socioId.trim() === ""
  ) {
    throw new Error("VALIDATION_ERROR: El socio es requerido");
  }

  if (!esMetodoValido(input.metodoPago)) {
    throw new Error("VALIDATION_ERROR: Método de pago inválido");
  }

  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({
    where: { id: input.socioId },
    include: { membresiaAsignada: true },
  });
  if (!socio) throw new Error("NOT_FOUND");

  const membresia = socio.membresiaAsignada;
  if (!membresia) {
    throw new Error("VALIDATION_ERROR: El socio no tiene una membresía asignada");
  }

  const [ultimaCuota, config] = await Promise.all([
    prisma.cuota.findFirst({
      where: { socioId: input.socioId },
      orderBy: { fechaVencimiento: "desc" },
    }),
    prisma.configuracionDelSistema.findFirst(),
  ]);

  const hoy = input.hoy ?? new Date();
  const diaLimite = config?.diaLimitePago ?? DIA_LIMITE_PAGO_DEFAULT;
  const diaCorte = config?.diaCorteAltaTardia ?? DIA_CORTE_ALTA_TARDIA_DEFAULT;
  const gracia = config?.periodoGracia ?? PERIODO_GRACIA_DEFAULT;

  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;

  const plan = planDePago({
    ultimoPeriodoCubierto,
    hoy,
    precio: Number(membresia.precio),
    diaCorte,
  });

  const fechaPago = input.fechaPago ?? hoy;

  // Anti doble-cobro (PG-4, sin cambio de schema): no hay unique en
  // (socioId, fechaVencimiento), así que dos POST concurrentes del mismo período se
  // detectan por regla. La transacción corre con `isolationLevel: "Serializable"`:
  // dos intentos concurrentes se serializan y uno falla con `P2034` (el mapper lo
  // traduce a 409). GUARD: si ya existe una cuota con la MISMA `fechaVencimiento` que
  // el tramo que se intenta crear, se aborta con `PAYMENT_ALREADY_REGISTERED` (409)
  // y no se crea ni Cuota ni Pago.
  const { cuota, pago } = await prisma.$transaction(
    async (tx) => {
      const cuotaExistente = await tx.cuota.findFirst({
        where: { socioId: input.socioId, fechaVencimiento: plan.cubreHasta },
        select: { id: true },
      });
      if (cuotaExistente) {
        throw new Error(PAYMENT_ALREADY_REGISTERED);
      }

      const cuotaCreada = await tx.cuota.create({
        data: {
          socioId: input.socioId,
          membresiaId: membresia.id,
          fechaInicio: plan.cubreDesde,
          fechaVencimiento: plan.cubreHasta,
        },
      });
      const pagoCreado = await tx.pago.create({
        data: {
          monto: plan.monto,
          metodoPago: input.metodoPago as PrismaMetodoPago,
          socioId: input.socioId,
          cuotaId: cuotaCreada.id,
          estado: "CONFIRMADO",
          fechaPago,
        },
      });
      return { cuota: cuotaCreada, pago: pagoCreado };
    },
    { isolationLevel: "Serializable" }
  );

  // El último período cubierto tras este pago es el del tramo creado (cubreHasta es el
  // último instante del último mes cubierto).
  const estadoCuota = estadoCuotaSocio({
    ultimoPeriodoCubierto: periodoDe(plan.cubreHasta),
    hoy,
    diaLimite,
    gracia,
  });

  return { pago, cuota, plan, estadoCuota };
}

/**
 * Historial de pagos de un socio, con su cuota, del más reciente al más viejo.
 */
export async function listarPagosDeSocio(socioId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.pago.findMany({
    where: { socioId },
    include: { cuota: true },
    orderBy: { fechaPago: "desc" },
  });
}
