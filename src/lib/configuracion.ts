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
  /** Porcentaje (Decimal en la base). Hoy nada cobra con él (D-40); ver spec `oferta-reactivacion`. */
  descuentoReactivacion: number;
  /**
   * Los tres campos de la oferta de reactivación (spec `oferta-reactivacion`) todavía no son columnas:
   * T-045b las agrega. Hasta entonces la fila no los trae y el lector devuelve su valor por defecto
   * (oferta apagada), así el resto del código ya puede depender de la forma final.
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

export async function getConfiguracion(db?: ConfiguracionReader): Promise<Configuracion> {
  const cliente = db ?? (await import("@/lib/db")).prisma;
  const fila: FilaConfiguracion | null = await cliente.configuracionDelSistema.findFirst({
    orderBy: { updatedAt: "desc" },
  });
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
