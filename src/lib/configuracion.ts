/**
 * Lector único de `ConfiguracionDelSistema` (T-043a, D-54).
 *
 * Todo el sistema lee la configuración por acá: siempre la fila más reciente (`updatedAt` descendente),
 * con un valor por defecto por campo cuando no hay fila o a la fila le falta un valor. Un test guardián
 * (`configuracion.guard.test.ts`) impide leer la tabla por otro camino.
 *
 * Recibe el cliente (o la transacción) por parámetro para que `registrarPago`, el control de acceso y los
 * tests lo usen sin tocar `@/lib/db`. Sin parámetro, carga la base de forma diferida: este módulo se importa
 * desde archivos que también llegan al navegador (`src/api/socios.ts`) y no puede arrastrar Prisma.
 */
import type { ConfiguracionDelSistema } from "@prisma/client";

export interface Configuracion {
  capacidadMaxima: number;
  periodoGracia: number;
  diasInactividad: number;
  /** Porcentaje (Decimal en la base). Lo aplica la oferta de reactivación; ver spec `oferta-reactivacion` y D-54. */
  descuentoReactivacion: number;
  /**
   * Los tres campos de la oferta de reactivación (spec `oferta-reactivacion`). Son columnas desde T-045b;
   * si a una fila le faltan, el lector devuelve su valor por defecto (oferta apagada).
   */
  ofertaReactivacionActiva: boolean;
  diasSinAsistirParaOferta: number;
  enfriamientoOfertaDias: number;
  ventanaAforoMinutos: number;
  diaLimitePago: number;
  diaCorteAltaTardia: number;
  antiPassbackMinutos: number;
}

/**
 * Valores cuando no hay fila o falta un campo. Son los que el código ya usaba suelto en cada lugar:
 * 0 de capacidad ("Aforo no configurado"), sin gracia, 15 días de inactividad, ventana de aforo de 90 min,
 * pago hasta el día 10, corte de alta tardía el 20 y 60 min de anti-passback. La oferta de reactivación
 * arranca apagada, a los 30 días sin asistir y con 180 días de enfriamiento.
 */
export const CONFIGURACION_POR_DEFECTO: Readonly<Configuracion> = Object.freeze({
  capacidadMaxima: 0,
  periodoGracia: 0,
  diasInactividad: 15,
  descuentoReactivacion: 0,
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
});

/** Fila tal como la devuelve Prisma, más los campos de la oferta que T-045b convierte en columnas. */
type FilaConfiguracion = Partial<ConfiguracionDelSistema> &
  Partial<Pick<Configuracion, "ofertaReactivacionActiva" | "diasSinAsistirParaOferta" | "enfriamientoOfertaDias">>;

/** Lo único que el lector necesita del cliente de Prisma (o de una transacción). */
export interface ConfiguracionReader {
  configuracionDelSistema: {
    findFirst(args: { orderBy: { updatedAt: "desc" } }): Promise<FilaConfiguracion | null>;
  };
}

/** Normaliza una fila (o su ausencia) a la forma completa de `Configuracion`, con defaults por campo. */
function normalizarFila(fila: FilaConfiguracion | null): Configuracion {
  const d = CONFIGURACION_POR_DEFECTO;
  return {
    capacidadMaxima: fila?.capacidadMaxima ?? d.capacidadMaxima,
    periodoGracia: fila?.periodoGracia ?? d.periodoGracia,
    diasInactividad: fila?.diasInactividad ?? d.diasInactividad,
    descuentoReactivacion:
      fila?.descuentoReactivacion != null ? Number(fila.descuentoReactivacion) : d.descuentoReactivacion,
    ofertaReactivacionActiva: fila?.ofertaReactivacionActiva ?? d.ofertaReactivacionActiva,
    diasSinAsistirParaOferta: fila?.diasSinAsistirParaOferta ?? d.diasSinAsistirParaOferta,
    enfriamientoOfertaDias: fila?.enfriamientoOfertaDias ?? d.enfriamientoOfertaDias,
    ventanaAforoMinutos: fila?.ventanaAforoMinutos ?? d.ventanaAforoMinutos,
    diaLimitePago: fila?.diaLimitePago ?? d.diaLimitePago,
    diaCorteAltaTardia: fila?.diaCorteAltaTardia ?? d.diaCorteAltaTardia,
    antiPassbackMinutos: fila?.antiPassbackMinutos ?? d.antiPassbackMinutos,
  };
}

export async function getConfiguracion(db?: ConfiguracionReader): Promise<Configuracion> {
  const cliente = db ?? (await import("@/lib/db")).prisma;
  const fila: FilaConfiguracion | null = await cliente.configuracionDelSistema.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return normalizarFila(fila);
}

/**
 * Aplica los cambios y devuelve la configuración resultante. Actualiza la fila más reciente o la
 * crea si no existe, y en la misma transacción deja el RegistroDeAuditoria con el valor anterior y
 * el nuevo de cada campo que cambió (D-54). Sin cambios no escribe auditoría.
 *
 * CFG-2: si no hay fila, solo se crea cuando hay al menos un cambio real; un `PUT {}` no crea nada.
 * CFG-1: no se puede dejar la oferta activa con un descuento fuera de 1–50.
 *
 * Importa el cliente en forma diferida: este módulo llega al navegador y no puede arrastrar Prisma.
 */
export async function actualizarConfiguracion(
  cambios: Partial<Configuracion>,
  responsableId: string,
): Promise<Configuracion> {
  const { prisma } = await import("@/lib/db");
  return prisma.$transaction(async (tx) => {
    const fila = await tx.configuracionDelSistema.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    const antes = normalizarFila(fila);
    const despues: Configuracion = { ...antes, ...cambios };

    // CFG-1: la oferta no puede quedar encendida con un descuento inválido, porque
    // `evaluarOferta` la descartaría en silencio (`CONFIGURACION_INVALIDA`) y el
    // descuento nunca se aplicaría. Se rechaza ANTES de escribir (la transacción
    // revierte sola). Se exige el mismo rango que valida la API: 1–50.
    if (
      despues.ofertaReactivacionActiva &&
      (despues.descuentoReactivacion < 1 || despues.descuentoReactivacion > 50)
    ) {
      throw new Error(
        "VALIDATION_ERROR: Para activar la oferta de reactivación, el descuento debe estar entre 1 y 50",
      );
    }

    const cambiados = (Object.keys(CONFIGURACION_POR_DEFECTO) as (keyof Configuracion)[]).filter(
      (campo) => antes[campo] !== despues[campo],
    );

    if (fila) {
      if (cambiados.length > 0) {
        const data: Partial<Configuracion> = {};
        for (const campo of cambiados) {
          (data as Record<string, number | boolean>)[campo] = despues[campo];
        }
        await tx.configuracionDelSistema.update({ where: { id: fila.id }, data });
      }
    } else if (cambiados.length > 0) {
      // CFG-2: sin fila, solo se crea si hay un cambio real (`cambiados`). Un `PUT {}`
      // (o un valor igual al default) no debe crear nada. Y como la creación va por
      // este mismo camino, queda auditada por el bloque de abajo.
      await tx.configuracionDelSistema.create({ data: despues });
    }

    if (cambiados.length > 0) {
      const detalles: Record<string, { antes: number | boolean; despues: number | boolean }> = {};
      for (const campo of cambiados) {
        detalles[campo] = { antes: antes[campo], despues: despues[campo] };
      }
      await tx.registroDeAuditoria.create({
        data: {
          tipoOperacion: "MODIFICACION",
          responsableId,
          detalles: JSON.stringify(detalles),
        },
      });
    }

    return despues;
  });
}
