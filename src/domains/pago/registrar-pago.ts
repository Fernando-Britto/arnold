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
import type { Cuota, MetodoPago as PrismaMetodoPago, Pago } from "@prisma/client";
import { CONFIGURACION_POR_DEFECTO, getConfiguracion } from "@/lib/configuracion";
import {
  estadoCuotaSocio,
  periodoDe,
  planDePago,
  type EstadoCuotaSocio,
  type PlanDePago,
} from "./cuota";
import { aplicarOferta, type ConfigOferta } from "./oferta-reactivacion";
import { evaluarOfertaDeSocio } from "./oferta-reactivacion-consulta";

export const METODOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "TARJETA"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

/** Conflicto cuando ya existe una cuota para el período que se intenta pagar (PG-4). */
export const PAYMENT_ALREADY_REGISTERED =
  "PAYMENT_ALREADY_REGISTERED: Ya existe una cuota para el período que se intenta pagar";

/**
 * Conflicto cuando el monto que vio el recepcionista (`montoEsperado`) no coincide con el que
 * calcula el servidor (por ejemplo, la oferta se apagó entre la vista previa y el cobro). No se
 * crea nada: el mapper lo traduce a 409 (spec `oferta-reactivacion`).
 */
export const AMOUNT_CHANGED = "AMOUNT_CHANGED";

/**
 * PG-8: conflicto de serialización (Prisma `P2034`) al registrar un pago. Se
 * distingue del cierre de caja para no reportar un choque de cobro como "cierre
 * duplicado". El mapper lo traduce a 409 `PAYMENT_CONFLICT`.
 */
export const PAYMENT_CONFLICT =
  "PAYMENT_CONFLICT: Otro pago se registró al mismo tiempo; vuelva a intentarlo";

/** Defaults de `ConfiguracionDelSistema` cuando todavía no existe la fila (D-40). La fuente única es `@/lib/configuracion`. */
export const DIA_LIMITE_PAGO_DEFAULT = CONFIGURACION_POR_DEFECTO.diaLimitePago;
export const DIA_CORTE_ALTA_TARDIA_DEFAULT = CONFIGURACION_POR_DEFECTO.diaCorteAltaTardia;
export const PERIODO_GRACIA_DEFAULT = CONFIGURACION_POR_DEFECTO.periodoGracia;

export interface RegistrarPagoInput {
  socioId: string;
  /** Se valida en runtime: un valor fuera de `METODOS_PAGO` es un error de validación. */
  metodoPago: string;
  fechaPago?: Date;
  hoy?: Date;
  /**
   * Monto que el recepcionista vio en la vista previa (opcional). Si se envía y no coincide con el
   * que calcula el servidor, se aborta con `AMOUNT_CHANGED` (409) y no se crea nada. Si no se envía,
   * se cobra el monto calculado (comportamiento actual).
   */
  montoEsperado?: number;
}

export interface PagoRegistrado {
  pago: unknown;
  cuota: unknown;
  plan: PlanDePago;
  estadoCuota: EstadoCuotaSocio;
  /** Precio de lista antes del descuento; null si no hubo oferta (D-54). */
  montoLista: number | null;
  /** Porcentaje de la oferta aplicada; null si no hubo oferta (D-54). */
  descuentoPct: number | null;
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
 * @throws Error("AMOUNT_CHANGED: ...") si `montoEsperado` no coincide con el monto calculado
 *   (spec `oferta-reactivacion`; el route mapper lo traduce a 409).
 * @throws Error("PAYMENT_CONFLICT: ...") si la transacción choca por serialización (P2034);
 *   el route mapper lo traduce a 409 `PAYMENT_CONFLICT` (PG-8).
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
    getConfiguracion(prisma),
  ]);

  const hoy = input.hoy ?? new Date();
  const { diaLimitePago: diaLimite, diaCorteAltaTardia: diaCorte, periodoGracia: gracia } = config;

  // Configuración de la oferta (D-54) armada una sola vez, fuera de la transacción, desde la
  // configuración ya leída. Con la oferta apagada `aplicarOferta` no cambia el monto.
  const configOferta: ConfigOferta = {
    ofertaReactivacionActiva: config.ofertaReactivacionActiva,
    diasSinAsistirParaOferta: config.diasSinAsistirParaOferta,
    descuentoReactivacion: config.descuentoReactivacion,
    enfriamientoOfertaDias: config.enfriamientoOfertaDias,
  };

  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;

  // Estado de pago del socio ANTES de este cobro: es lo que la spec llama `estadoCuotaSocio` al
  // momento de cobrar (la condición 3 de elegibilidad mira la cuota vencida, no la que se crea).
  const estadoPagoAntes = estadoCuotaSocio({ ultimoPeriodoCubierto, hoy, diaLimite, gracia });

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
  // dos intentos concurrentes se serializan y uno falla con `P2034`. GUARD: si ya
  // existe una cuota con la MISMA `fechaVencimiento` que el tramo que se intenta
  // crear, se aborta con `PAYMENT_ALREADY_REGISTERED` (409) y no se crea ni Cuota
  // ni Pago.
  //
  // PG-8: un `P2034` en ESTE flujo es un choque de cobro, no de cierre de caja.
  // Se traduce a `PAYMENT_CONFLICT` (409 propio) para no reportarlo como
  // "cierre de caja duplicado" con el mapper compartido.
  let cuota: Cuota;
  let pago: Pago;
  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        const cuotaExistente = await tx.cuota.findFirst({
          where: { socioId: input.socioId, fechaVencimiento: plan.cubreHasta },
          select: { id: true },
        });
        if (cuotaExistente) {
          throw new Error(PAYMENT_ALREADY_REGISTERED);
        }

        // La elegibilidad y el descuento se evalúan DENTRO de la transacción Serializable: así dos
        // cobros simultáneos del mismo socio no pueden usar la misma oferta dos veces (la segunda
        // transacción ve el `Pago` con descuento que la primera acaba de confirmar).
        const evaluacion = await evaluarOfertaDeSocio(
          tx,
          input.socioId,
          configOferta,
          {
            estadoCuenta: socio.estadoCuota,
            // El flujo ya salió antes si `socio.membresiaAsignada` es null.
            tieneMembresia: true,
            estadoPago: estadoPagoAntes,
            fechaAlta: socio.fechaAlta,
          },
          hoy,
        );
        const cobro = aplicarOferta({ monto: plan.monto, evaluacion });

        // El recepcionista confirmó un monto que ya no es el vigente (p. ej. la oferta se apagó o
        // venció entre la vista previa y el cobro): se aborta sin crear nada.
        if (input.montoEsperado !== undefined && input.montoEsperado !== cobro.monto) {
          throw new Error(`${AMOUNT_CHANGED}: El monto cambió a ${cobro.monto}`);
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
            monto: cobro.monto,
            montoLista: cobro.montoLista,
            descuentoPct: cobro.descuentoPct,
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
    cuota = resultado.cuota;
    pago = resultado.pago;
  } catch (error) {
    // PG-8: colisión de serialización de ESTE cobro. Código propio para que el
    // mapper no lo reporte como un cierre de caja duplicado.
    if ((error as { code?: unknown } | null)?.code === "P2034") {
      throw Object.assign(new Error(PAYMENT_CONFLICT), { code: "PAYMENT_CONFLICT" });
    }
    throw error;
  }

  // El último período cubierto tras este pago es el del tramo creado (cubreHasta es el
  // último instante del último mes cubierto).
  const estadoCuota = estadoCuotaSocio({
    ultimoPeriodoCubierto: periodoDe(plan.cubreHasta),
    hoy,
    diaLimite,
    gracia,
  });

  return {
    pago,
    cuota,
    plan,
    estadoCuota,
    montoLista: pago.montoLista != null ? Number(pago.montoLista) : null,
    descuentoPct: pago.descuentoPct != null ? Number(pago.descuentoPct) : null,
  };
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
