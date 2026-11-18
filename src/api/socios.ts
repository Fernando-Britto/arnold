/**
 * Capa API de socios: búsqueda por DNI/nombre y vista previa de cobro para "Registrar Pago"
 * (T-033, rediseño de búsqueda por nombre). El cálculo del estado de cuota y del plan de pago
 * sale de las reglas puras (`src/domains/pago/cuota.ts`, D-40). Prisma se importa en forma
 * diferida para que este módulo pueda vivir también en el bundle del cliente (helpers de fetch).
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
import {
  evaluarOfertaDeSocio,
  type OfertaReader,
} from "@/domains/pago/oferta-reactivacion-consulta";
import { getConfiguracion, type Configuracion } from "@/lib/configuracion";
import type { EstadoCuenta } from "@/domains/acceso/check-in";
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
 * Fila de la grilla de búsqueda por nombre: lo mínimo para listar y elegir un cliente.
 */
export interface SocioResumen {
  id: string;
  nombre: string;
  dni: string;
  /** `Membresia.nombre`, o `null` si el socio no tiene membresía asignada. */
  membresia: string | null;
  /** ISO de la `Cuota` más reciente, o `null` si nunca pagó. */
  fechaVencimiento: string | null;
  estadoCuota: EstadoCuotaSocio;
}

/** Resultado paginado de la búsqueda por nombre. */
export interface BusquedaSociosResultado {
  items: SocioResumen[];
  total: number;
}

/**
 * Socio encontrado por DNI o por id. Nunca incluye `password` ni otros datos del `Usuario`
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
  /** ISO de la `Cuota` más reciente, o `null` si nunca pagó. */
  fechaVencimiento: string | null;
  /** Monto a cobrar hoy. `null` si el socio no tiene membresía asignada. */
  plan: PlanDePagoDTO | null;
  /**
   * Vista previa de la oferta de reactivación (D-54): `null` si el socio no es elegible o no
   * tiene plan. El descuento real se recalcula en el servidor al cobrar.
   */
  oferta: { montoLista: number; descuentoPct: number; montoFinal: number } | null;
}

/** Fila mínima de `Socio` con las relaciones que necesita el armado del `SocioBusqueda`. */
interface SocioConRelaciones {
  id: string;
  dni: string;
  telefono: string | null;
  estadoCuota: EstadoCuenta;
  fechaAlta: Date;
  usuario: { nombre: string; email: string } | null;
  membresiaAsignada: { id: string; nombre: string; precio: unknown } | null;
}

/** Fila cruda de la búsqueda por nombre (el total viene repetido por `COUNT(*) OVER()`). */
interface FilaSocioResumen {
  id: string;
  nombre: string;
  dni: string;
  membresiaNombre: string | null;
  fechaVencimiento: Date | null;
  total: number;
}

/** Límite por defecto y tope de la grilla de búsqueda. */
const LIMITE_BUSQUEDA_DEFECTO = 10;
const LIMITE_BUSQUEDA_MAX = 50;

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
 * Arma el `SocioBusqueda` (estado, plan y oferta) a partir del socio ya leído y de su última
 * cuota/la configuración. Compartido por la búsqueda por DNI y por id para no duplicar la regla.
 */
async function armarSocioBusqueda(
  db: OfertaReader,
  socio: SocioConRelaciones,
  ultimaCuota: { fechaVencimiento: Date } | null,
  config: Configuracion,
  hoy: Date,
): Promise<SocioBusqueda> {
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
          db,
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
    fechaVencimiento: ultimaCuota ? ultimaCuota.fechaVencimiento.toISOString() : null,
    plan,
    oferta,
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

  return armarSocioBusqueda(prisma, socio, ultimaCuota, config, hoy);
}

/**
 * Handle GET /api/socios/[id] — misma vista previa de cobro, buscando por id. Solo lectura.
 *
 * @throws Error("NOT_FOUND") si no existe un socio con ese id.
 */
export async function handleBuscarSocioPorId(
  id: string,
  hoy: Date = new Date(),
): Promise<SocioBusqueda> {
  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({
    where: { id },
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

  return armarSocioBusqueda(prisma, socio, ultimaCuota, config, hoy);
}

/**
 * Handle GET /api/socios?q= — busca socios por nombre/apellido (insensible a mayúsculas y tildes),
 * con paginación server-side y el estado de cuota de cada uno. Solo lectura.
 *
 * Un patrón por token separado por espacios (`juan perez` → dos `AND`) y siempre parametrizado:
 * `unaccent` no matchea tildes por sí solo y Prisma no lo expone en el query builder.
 */
export async function handleBuscarSociosPorNombre(
  params: { q: string; limit?: number; offset?: number },
  hoy: Date = new Date(),
): Promise<BusquedaSociosResultado> {
  const consulta = params.q.trim();
  if (!consulta) return { items: [], total: 0 };

  const limitPedido = params.limit ?? LIMITE_BUSQUEDA_DEFECTO;
  const limit = Number.isFinite(limitPedido)
    ? Math.min(LIMITE_BUSQUEDA_MAX, Math.max(1, Math.trunc(limitPedido)))
    : LIMITE_BUSQUEDA_DEFECTO;
  const offsetPedido = params.offset ?? 0;
  const offset = Number.isFinite(offsetPedido) ? Math.max(0, Math.trunc(offsetPedido)) : 0;

  const { prisma } = await import("@/lib/db");
  const config = await getConfiguracion(prisma);
  const { diaLimitePago: diaLimite, periodoGracia: gracia } = config;

  const { Prisma } = await import("@prisma/client");
  // Un nombre no necesita más de unos pocos tokens; el tope evita que una consulta larga
  // dispare decenas de ILIKE contra la base.
  const filtros = Prisma.join(
    consulta
      .split(/\s+/)
      .slice(0, 8)
      .map((token) => Prisma.sql`unaccent(u."nombre") ILIKE unaccent(${`%${token}%`})`),
    " AND ",
  );

  // shortcut: unaccent no usa índice; si la tabla de socios crece a decenas de miles, agregar un índice de expresión/trigram.
  const filas = await prisma.$queryRaw<FilaSocioResumen[]>(Prisma.sql`
    SELECT s.id, u.nombre, s.dni, m.nombre AS "membresiaNombre",
      c."fechaVencimiento", COUNT(*) OVER()::int AS total
    FROM "Socio" s
    JOIN "Usuario" u ON u.id = s."usuarioId"
    LEFT JOIN "Membresia" m ON m.id = s."membresiaAsignadaId"
    LEFT JOIN LATERAL (
      SELECT "fechaVencimiento"
      FROM "Cuota"
      WHERE "socioId" = s.id
      ORDER BY "fechaVencimiento" DESC
      LIMIT 1
    ) c ON true
    WHERE ${filtros}
    ORDER BY u.nombre ASC, s.id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const items: SocioResumen[] = filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    dni: fila.dni,
    membresia: fila.membresiaNombre,
    fechaVencimiento: fila.fechaVencimiento ? fila.fechaVencimiento.toISOString() : null,
    estadoCuota: estadoCuotaSocio({
      ultimoPeriodoCubierto: fila.fechaVencimiento ? periodoDe(fila.fechaVencimiento) : null,
      hoy,
      diaLimite,
      gracia,
    }),
  }));

  return { items, total: filas[0]?.total ?? 0 };
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

/** Client-side API call: buscar socios por nombre con paginación server-side. */
export async function fetchSociosPorNombre(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<BusquedaSociosResultado> {
  const search = new URLSearchParams({ q: params.q });
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const response = await fetch(`/api/socios?${search.toString()}`);
  await throwIfNotOk(response, "No se pudieron buscar los socios");
  return response.json();
}

/** Client-side API call: traer la vista previa de cobro de un socio por id. */
export async function fetchSocioPorId(id: string): Promise<SocioBusqueda> {
  const response = await fetch(`/api/socios/${encodeURIComponent(id)}`);
  await throwIfNotOk(response, "No se pudo buscar el socio");
  return response.json();
}
