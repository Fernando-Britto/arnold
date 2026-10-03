import type { HomeInternoData } from "@/api/home-interno";

/**
 * Consistent Home_Interno payload shared by the page tests (T-021a/T-021b).
 * `ahora` is 2026-09-30T18:00Z. Numbers follow the spec's Data Scenarios.
 * Includes events the feed MUST drop (check-in, >24h) so tests can prove it.
 * Interim stand-in until T-024 delivers the real factories.
 */
export function buildHomeInternoData(overrides: Partial<HomeInternoData> = {}): HomeInternoData {
  return {
    ahora: new Date("2026-09-30T18:00:00Z"),
    config: { capacidadMaxima: 100, periodoGracia: 3, diasInactividad: 15 },
    maquinas: [
      ...Array(2).fill({ estado: "FUERA_DE_SERVICIO" as const }),
      ...Array(18).fill({ estado: "DISPONIBLE" as const }),
    ],
    pagos: [
      ...Array(3).fill({ monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO", fecha: new Date("2026-09-30T10:00:00Z") }),
      ...Array(2).fill({ monto: 100, metodoPago: "TRANSFERENCIA" as const, estado: "CONFIRMADO", fecha: new Date("2026-09-30T11:00:00Z") }),
    ],
    cuotas: [{ socioId: "s1", socioNombre: "Marta G.", fechaVencimiento: new Date("2026-10-01T00:00:00Z") }],
    ultimasAsistencias: Array(42).fill(new Date("2026-09-01T00:00:00Z")),
    aforo: { asistenciasActivas: 87, horas: [{ hora: 18, ocupacion: 87 }], horaActual: 18 },
    personal: [{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }],
    contadores: { rutinas: 124, ejercicios: 342, clientes: 892, membresias: 15 },
    eventos: [
      { tipo: "PAGO", nombre: "Ana López", descripcion: "Pago de membresía Pro", fecha: new Date("2026-09-30T17:45:00Z") },
      { tipo: "ALTA_SOCIO", nombre: "Carlos Mendez", descripcion: "Alta de nuevo socio", fecha: new Date("2026-09-30T16:00:00Z") },
      { tipo: "INGRESO", nombre: "Lucía Paz", descripcion: "Ingreso al gimnasio", fecha: new Date("2026-09-30T17:50:00Z") },
      { tipo: "PAGO", nombre: "Viejo Pago", descripcion: "Pago de membresía Basic", fecha: new Date("2026-09-29T10:00:00Z") },
    ],
    ...overrides,
  };
}
