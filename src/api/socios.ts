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
import {
  DIA_CORTE_ALTA_TARDIA_DEFAULT,
  DIA_LIMITE_PAGO_DEFAULT,
  PERIODO_GRACIA_DEFAULT,
} from "@/domains/pago/registrar-pago";
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
    where: { dni },
    include: { usuario: true, membresiaAsignada: true },
  });
  if (!socio) throw new Error("NOT_FOUND");

  const [ultimaCuota, config] = await Promise.all([
    prisma.cuota.findFirst({
      where: { socioId: socio.id },
      orderBy: { fechaVencimiento: "desc" },
    }),
    prisma.configuracionDelSistema.findFirst(),
  ]);

  const diaLimite = config?.diaLimitePago ?? DIA_LIMITE_PAGO_DEFAULT;
  const diaCorte = config?.diaCorteAltaTardia ?? DIA_CORTE_ALTA_TARDIA_DEFAULT;
  const gracia = config?.periodoGracia ?? PERIODO_GRACIA_DEFAULT;
  const ultimoPeriodoCubierto = ultimaCuota ? periodoDe(ultimaCuota.fechaVencimiento) : null;

  const membresia = socio.membresiaAsignada;
  const plan = membresia
    ? serializarPlan(
        planDePago({
          ultimoPeriodoCubierto,
          hoy,
          precio: Number(membresia.precio),
          diaCorte,
        })
      )
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
    estadoCuota: estadoCuotaSocio({ ultimoPeriodoCubierto, hoy, diaLimite, gracia }),
    plan,
  };
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for page.tsx)
 * ============================================
 */

/** Authorization header con el JWT de localStorage (mismo patrón que clientes/pagos). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Client-side API call: buscar un socio por DNI.
 */
export async function fetchSocioPorDni(dni: string): Promise<SocioBusqueda> {
  const response = await fetch(`/api/socios?dni=${encodeURIComponent(dni)}`, {
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudo buscar el socio");
  return response.json();
}
