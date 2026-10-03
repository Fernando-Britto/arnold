import type { HomeInternoPart1Raw } from "@/domains/home-interno/home-interno";

/**
 * Client-side data access for Home_Interno (Row_Acciones/Hoy/Operación).
 * Spec: openspec/specs/home-interno-dashboard/spec.md
 *
 * NOTE — scope boundary (documented, not hidden): `/api/home-interno` does NOT
 * exist yet. Same situation as `/api/home-socio`: building it for real needs
 * aggregation queries over Máquina, Pago, Cuota, Asistencia, Empleado and
 * ConfiguracionDelSistema, none of which have a repository layer today. This
 * module fixes the wire contract so the page can be built and tested now
 * against a mocked `fetchHomeInternoPart1`. `ahora` is the SERVER's clock, so
 * every card is derived against the same instant (and the page is testable
 * without fake timers). T-021b extends this contract with counters + events.
 *
 * Wire format uses ISO strings; this function revives them into Dates.
 */
export type HomeInternoPart1Data = HomeInternoPart1Raw & { ahora: Date };

interface HomeInternoPart1DTO extends Omit<HomeInternoPart1Raw, "pagos" | "cuotas" | "ultimasAsistencias"> {
  ahora: string;
  pagos: (Omit<HomeInternoPart1Raw["pagos"][number], "fecha"> & { fecha: string })[];
  cuotas: (Omit<HomeInternoPart1Raw["cuotas"][number], "fechaVencimiento"> & { fechaVencimiento: string })[];
  ultimasAsistencias: (string | null)[];
}

export async function fetchHomeInternoPart1(): Promise<HomeInternoPart1Data> {
  const response = await fetch("/api/home-interno");
  if (!response.ok) {
    throw new Error(`Failed to fetch home-interno data: ${response.statusText}`);
  }
  const dto: HomeInternoPart1DTO = await response.json();
  return {
    ...dto,
    ahora: new Date(dto.ahora),
    pagos: dto.pagos.map((p) => ({ ...p, fecha: new Date(p.fecha) })),
    cuotas: dto.cuotas.map((c) => ({ ...c, fechaVencimiento: new Date(c.fechaVencimiento) })),
    ultimasAsistencias: dto.ultimasAsistencias.map((f) => (f ? new Date(f) : null)),
  };
}
