/**
 * Cierre de caja (T-040, D-42): agrupa los `Pago` del turno por método y crea el
 * `CierreDeCaja`. La lógica de totales es pura; el servicio habla con Prisma.
 *
 * Decisiones documentadas:
 * - Solo se consideran pagos `CONFIRMADO`. `PENDIENTE` y `ANULADO` no entran.
 * - Un cierre con cero pagos ES válido: se crea igual (el turno se puede cerrar
 *   aunque no haya recaudado nada). Los totales quedan en cero.
 * - `responsableId` es un `Empleado.id`; `resolverEmpleadoId` traduce el `Usuario`
 *   logueado (vía `Empleado.usuarioId`) y falla con un error de validación claro
 *   si el usuario no tiene un empleado asociado.
 */
import type { MetodoPago } from "@prisma/client";

export const METODOS_PAGO_CIERRE = ["EFECTIVO", "TRANSFERENCIA", "TARJETA"] as const;

/** Fila de `Pago` reducida a lo que el cierre necesita. */
export interface PagoParaCierre {
  id: string;
  /** Prisma `Decimal` o `number`: se normaliza con `Number(...)`. */
  monto: number | { toString(): string };
  metodoPago: MetodoPago | string;
  estado: string;
  cierreDeCajaId?: string | null;
}

export interface TotalesDeCaja {
  totalRecaudado: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalTarjeta: number;
  cantidadOperaciones: number;
}

export interface RangoDeCierre {
  desde: Date;
  hasta: Date;
}

export interface CerrarCajaInput extends RangoDeCierre {
  /** `Empleado.id` del responsable del turno. */
  responsableId: string;
}

export interface CierreDeCajaCreado extends TotalesDeCaja {
  id: string;
  responsableId: string;
  pagos: PagoParaCierre[];
  [key: string]: unknown;
}

/** Redondea a centavos evitando el ruido de punto flotante (0.1 + 0.2). */
function redondearCentavos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function montoDe(pago: PagoParaCierre): number {
  return Number(pago.monto);
}

/**
 * Totales del turno (PURA): suma los `CONFIRMADO` por método y devuelve el total
 * recaudado y la cantidad de operaciones, redondeado al centavo.
 */
export function calcularTotales(pagos: PagoParaCierre[]): TotalesDeCaja {
  const confirmados = pagos.filter((p) => p.estado === "CONFIRMADO");
  const sumar = (metodo: string) =>
    redondearCentavos(
      confirmados
        .filter((p) => p.metodoPago === metodo)
        .reduce((sum, p) => sum + montoDe(p), 0)
    );

  const totalEfectivo = sumar("EFECTIVO");
  const totalTransferencia = sumar("TRANSFERENCIA");
  const totalTarjeta = sumar("TARJETA");

  return {
    totalRecaudado: redondearCentavos(totalEfectivo + totalTransferencia + totalTarjeta),
    totalEfectivo,
    totalTransferencia,
    totalTarjeta,
    cantidadOperaciones: confirmados.length,
  };
}

/**
 * Cierra la caja del turno: en UNA transacción crea el `CierreDeCaja` con los
 * totales y marca con `cierreDeCajaId` exactamente los pagos confirmados del rango
 * que todavía no pertenecían a ningún cierre. Devuelve el cierre creado con sus pagos.
 */
export async function cerrarCaja(input: CerrarCajaInput): Promise<CierreDeCajaCreado> {
  const { prisma } = await import("@/lib/db");
  const { responsableId, desde, hasta } = input;

  return prisma.$transaction(async (tx) => {
    const pagos = (await tx.pago.findMany({
      where: {
        estado: "CONFIRMADO",
        cierreDeCajaId: null,
        fechaPago: { gte: desde, lte: hasta },
      },
    })) as PagoParaCierre[];

    const totales = calcularTotales(pagos);

    const cierre = await tx.cierreDeCaja.create({
      data: {
        responsableId,
        totalRecaudado: totales.totalRecaudado,
        totalEfectivo: totales.totalEfectivo,
        totalTransferencia: totales.totalTransferencia,
        totalTarjeta: totales.totalTarjeta,
        cantidadOperaciones: totales.cantidadOperaciones,
      },
    });

    if (pagos.length > 0) {
      await tx.pago.updateMany({
        where: { id: { in: pagos.map((p) => p.id) } },
        data: { cierreDeCajaId: cierre.id },
      });
    }

    // Prisma devuelve `Decimal` en los totales; la API los serializa a string/número.
    return { ...cierre, pagos } as unknown as CierreDeCajaCreado;
  });
}

/**
 * Resuelve el `Empleado.id` del `Usuario` logueado.
 *
 * @throws Error("VALIDATION_ERROR: ...") si el usuario no tiene un empleado asociado.
 */
export async function resolverEmpleadoId(usuarioId: string): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const empleado = await prisma.empleado.findUnique({ where: { usuarioId } });
  if (!empleado) {
    throw new Error("VALIDATION_ERROR: El usuario no tiene un empleado asociado");
  }
  return empleado.id;
}

/** Pagos confirmados del rango que todavía no fueron incluidos en un cierre. */
export async function pagosPendientesDeCierre({
  desde,
  hasta,
}: RangoDeCierre): Promise<PagoParaCierre[]> {
  const { prisma } = await import("@/lib/db");
  return prisma.pago.findMany({
    where: {
      estado: "CONFIRMADO",
      cierreDeCajaId: null,
      fechaPago: { gte: desde, lte: hasta },
    },
    orderBy: { fechaPago: "asc" },
  });
}

/** Totales que tendría el cierre si se confirmara ahora (sin persistir nada). */
export async function previsualizarCierre(rango: RangoDeCierre): Promise<TotalesDeCaja> {
  return calcularTotales(await pagosPendientesDeCierre(rango));
}

/** Cierres recientes, del más nuevo al más viejo, con sus pagos. */
export async function listarCierres(limite = 20) {
  const { prisma } = await import("@/lib/db");
  return prisma.cierreDeCaja.findMany({
    orderBy: { createdAt: "desc" },
    take: limite,
    include: { pagos: true },
  });
}
