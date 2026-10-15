/**
 * Consulta de elegibilidad de la oferta de reactivación (T-045c, D-54). Separada del módulo puro
 * (`./oferta-reactivacion`) porque acá sí se toca la base: se leen la última asistencia y el último
 * pago con descuento, y la decisión se delega en `evaluarOferta`.
 * Spec: openspec/specs/oferta-reactivacion/spec.md
 */
import type { EstadoCuenta } from "@/domains/acceso/check-in";
import { evaluarOferta, type ConfigOferta, type EvaluacionOferta } from "./oferta-reactivacion";
import type { EstadoCuotaSocio } from "./cuota";

/** Lo único que hace falta del cliente de Prisma (o de una transacción) para evaluar la oferta. */
export interface OfertaReader {
  asistencia: {
    findFirst(args: {
      where: { socioId: string; estado: "PERMITIDO" };
      orderBy: { fechaHora: "desc" };
      select: { fechaHora: true };
    }): Promise<{ fechaHora: Date } | null>;
  };
  pago: {
    findFirst(args: {
      where: {
        socioId: string;
        // Un pago ANULADO cuenta igual que uno CONFIRMADO (P-39): la oferta ya se usó y no
        // vuelve. Con `estado: "CONFIRMADO"` a secas, anular el pago con descuento lo borraría
        // de esta mirada y la oferta reaparecería.
        estado: { in: ("CONFIRMADO" | "ANULADO")[] };
        descuentoPct: { not: null };
      };
      orderBy: { fechaPago: "desc" };
      select: { fechaPago: true };
    }): Promise<{ fechaPago: Date } | null>;
  };
}

/** Lo que quien consulta ya sabe del socio (D-54, condiciones 2 y 3 de la spec). */
export interface ContextoOferta {
  /** Estado de la CUENTA (`Socio.estadoCuota`, D-46). */
  estadoCuenta: EstadoCuenta;
  tieneMembresia: boolean;
  /** Estado de PAGO calculado con `estadoCuotaSocio` (D-40). */
  estadoPago: EstadoCuotaSocio;
  fechaAlta: Date;
}

/**
 * Evalúa la oferta de un socio leyendo la base. El filtro `estado: "PERMITIDO"` es el que fija la spec:
 * un ingreso autorizado por excepción cuenta como actividad y un `DENEGADO` no, por eso el `DENEGADO`
 * ni se consulta. Los dos `findFirst` corren en paralelo.
 */
export async function evaluarOfertaDeSocio(
  db: OfertaReader,
  socioId: string,
  config: ConfigOferta,
  contexto: ContextoOferta,
  hoy: Date,
): Promise<EvaluacionOferta> {
  // Con la oferta apagada la decisión no depende de la base: se delega igual en `evaluarOferta`
  // (que devuelve OFERTA_APAGADA antes de mirar nada) en vez de re-escribir la regla acá, así no se
  // puede desincronizar si la regla pura cambia. Las fechas no importan porque no se llega a usarlas,
  // y cortar antes del `Promise.all` evita dos lecturas de más dentro de la transacción Serializable
  // que cobra, en el camino por defecto (la oferta arranca apagada).
  if (!config.ofertaReactivacionActiva) {
    return evaluarOferta({
      ...contexto,
      config,
      ultimaAsistenciaPermitida: null,
      ultimoPagoConDescuento: null,
      hoy,
    });
  }

  const [asistencia, pago] = await Promise.all([
    db.asistencia.findFirst({
      where: { socioId, estado: "PERMITIDO" },
      orderBy: { fechaHora: "desc" },
      select: { fechaHora: true },
    }),
    db.pago.findFirst({
      where: { socioId, estado: { in: ["CONFIRMADO", "ANULADO"] }, descuentoPct: { not: null } },
      orderBy: { fechaPago: "desc" },
      select: { fechaPago: true },
    }),
  ]);

  return evaluarOferta({
    config,
    estadoCuenta: contexto.estadoCuenta,
    tieneMembresia: contexto.tieneMembresia,
    estadoPago: contexto.estadoPago,
    ultimaAsistenciaPermitida: asistencia?.fechaHora ?? null,
    fechaAlta: contexto.fechaAlta,
    ultimoPagoConDescuento: pago?.fechaPago ?? null,
    hoy,
  });
}
