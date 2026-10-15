/**
 * Capa API de socios (T-033): búsqueda por DNI para la pantalla "Registrar Pago".
 * El cálculo del estado de cuota y del plan de pago sale de las reglas puras
 * (`src/domains/pago/cuota.ts`, D-40). Prisma se importa en forma diferida para
 * que este módulo pueda vivir también en el bundle del cliente (helpers de fetch).
 */
import {
  estadoCuotaSocio,
  periodoDe,
  planDePago,
  type EstadoCuotaSocio,
  type Periodo,
  type PlanDePago,
  type TipoPlanDePago,
} from "@/domains/pago/cuota";
import { aplicarOferta, type ConfigOferta } from "@/domains/pago/oferta-reactivacion";
import { evaluarOfertaDeSocio } from "@/domains/pago/oferta-reactivacion-consulta";
import { getConfiguracion } from "@/lib/configuracion";
import { normalizeDNI } from "@/domains/cliente/cliente";
import { throwIfNotOk } from "@/utils/api-error";

/** Membresía asignada, reducida a lo que la pantalla de pago necesita mostrar. */
export interface MembresiaResumen {
  id: string;
  nombre: string;
  precio: number;
}

/** Plan de pago serializable (fechas en ISO) para la previsualización en el cliente. */
export interface PlanDePagoDTO {
  tipo: TipoPlanDePago;
  periodos: Periodo[];
  monto: number;
  cubreDesde: string;
  cubreHasta: string;
}

/**
 * Socio encontrado por DNI. Nunca incluye `password` ni otros datos del `Usuario`
 * que no sean nombre/email.
 */
export interface SocioBusqueda {
  id: string;
  nombre: string;
  dni: string;
  email: string;
  telefono: string | null;
  membresia: MembresiaResumen | null;
  estadoCuota: EstadoCuotaSocio;
  /** Monto a cobrar hoy. `null` si el socio no tiene membresía asignada. */
  plan: PlanDePagoDTO | null;
  /**
   * Vista previa de la oferta de reactivación (D-54): `null` si el socio no es elegible o no
   * tiene plan. El descuento real se recalcula en el servidor al cobrar.
   */
  oferta: { montoLista: number; descuentoPct: number; montoFinal: number } | null;
}

function serializarPlan(plan: PlanDePago): PlanDePagoDTO {
  return {
    tipo: plan.tipo,
    periodos: plan.periodos,
    monto: plan.monto,
    cubreDesde: plan.cubreDesde.toISOString(),
    cubreHasta: plan.cubreHasta.toISOString(),
  };
}

/**
 * Handle GET /api/socios?dni= — busca un socio por DNI y calcula su estado de cuota
 * (`estadoCuotaSocio`) y el plan de pago a cobrar ahora (`planDePago`). Solo lectura.
 *
 * @throws Error("NOT_FOUND") si no existe un socio con ese DNI.
 */
export async function handleBuscarSocio(dni: string, hoy: Date = new Date()): Promise<SocioBusqueda> {
  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({
    where: { dni: normalizeDNI(dni) },
    include: { usuario: true, membresiaAsignada: true },
  });
  if (!socio) throw new Error("NOT_FOUND");

  const [ultimaCuota, config] = await Promise.all([
    prisma.cuota.findFirst({
      where: { socioId: socio.id },
      orderBy: { fechaVencimiento: "desc" },
    }),
    getConfiguracion(prisma),
  ]);

  const { diaLimitePago: diaLimite, diaCorteAltaTardia: diaCorte, periodoGracia: gracia } = config;
  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;

  const membresia = socio.membresiaAsignada;
  const planComoDominio = membresia
    ? planDePago({
        ultimoPeriodoCubierto,
        hoy,
        precio: Number(membresia.precio),
        diaCorte,
      })
    : null;
  const plan = planComoDominio ? serializarPlan(planComoDominio) : null;

  const estadoPago = estadoCuotaSocio({ ultimoPeriodoCubierto, hoy, diaLimite, gracia });

  // Vista previa de la oferta (D-54): solo lectura. Se evalúa sobre el monto SIN serializar y el
  // descuento real se vuelve a calcular en el servidor al cobrar (`registrarPago`).
  const configOferta: ConfigOferta = {
    ofertaReactivacionActiva: config.ofertaReactivacionActiva,
    diasSinAsistirParaOferta: config.diasSinAsistirParaOferta,
    descuentoReactivacion: config.descuentoReactivacion,
    enfriamientoOfertaDias: config.enfriamientoOfertaDias,
  };
  const cobro = planComoDominio
    ? aplicarOferta({
        monto: planComoDominio.monto,
        evaluacion: await evaluarOfertaDeSocio(
          prisma,
          socio.id,
          configOferta,
          {
            estadoCuenta: socio.estadoCuota,
            tieneMembresia: true,
            estadoPago,
            fechaAlta: socio.fechaAlta,
          },
          hoy,
        ),
      })
    : null;
  const oferta =
    cobro && cobro.montoLista !== null && cobro.descuentoPct !== null
      ? { montoLista: cobro.montoLista, descuentoPct: cobro.descuentoPct, montoFinal: cobro.monto }
      : null;

  return {
    id: socio.id,
    nombre: socio.usuario?.nombre ?? "",
    dni: socio.dni,
    email: socio.usuario?.email ?? "",
    telefono: socio.telefono ?? null,
    membresia: membresia
      ? { id: membresia.id, nombre: membresia.nombre, precio: Number(membresia.precio) }
      : null,
    estadoCuota: estadoPago,
    plan,
    oferta,
  };
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/**
 * Client-side API call: buscar un socio por DNI. La sesión viaja en la cookie (HttpOnly);
 * el cliente no adjunta headers de auth (PG-7).
 */
export async function fetchSocioPorDni(dni: string): Promise<SocioBusqueda> {
  const response = await fetch(`/api/socios?dni=${encodeURIComponent(dni)}`);
  await throwIfNotOk(response, "No se pudo buscar el socio");
  return response.json();
}
