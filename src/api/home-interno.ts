import type { HomeInternoRaw } from "@/domains/home-interno/home-interno";

/**
 * Client-side data access for Home_Interno (all five zones).
 * Spec: openspec/specs/home-interno-dashboard/spec.md
 *
 * NOTE — scope boundary (documented, not hidden): `/api/home-interno` does NOT
 * exist yet. Same situation as `/api/home-socio`: building it for real needs
 * aggregation queries over Máquina, Pago, Cuota, Asistencia, Empleado and
 * ConfiguracionDelSistema, none of which have a repository layer today. This
 * module fixes the wire contract so the page can be built and tested now
 * against a mocked `fetchHomeInternoData`. `ahora` is the SERVER's clock, so
 * every card is derived against the same instant (and the page is testable
 * without fake timers). Includes the Row_Gestion counters and the raw activity events (T-021b).
 *
 * Wire format uses ISO strings; this function revives them into Dates.
 */
export type HomeInternoData = HomeInternoRaw & { ahora: Date };

interface HomeInternoDTO
  extends Omit<HomeInternoRaw, "pagos" | "cuotas" | "ultimasAsistencias" | "eventos"> {
  ahora: string;
  pagos: (Omit<HomeInternoRaw["pagos"][number], "fecha"> & { fecha: string })[];
  cuotas: (Omit<HomeInternoRaw["cuotas"][number], "fechaVencimiento"> & { fechaVencimiento: string })[];
  ultimasAsistencias: (string | null)[];
  eventos: (Omit<HomeInternoRaw["eventos"][number], "fecha"> & { fecha: string })[];
}

export async function fetchHomeInternoData(): Promise<HomeInternoData> {
  const response = await fetch("/api/home-interno");
  if (!response.ok) {
    throw new Error(`Failed to fetch home-interno data: ${response.statusText}`);
  }
  const dto: HomeInternoDTO = await response.json();
  return {
    ...dto,
    ahora: new Date(dto.ahora),
    pagos: dto.pagos.map((p) => ({ ...p, fecha: new Date(p.fecha) })),
    cuotas: dto.cuotas.map((c) => ({ ...c, fechaVencimiento: new Date(c.fechaVencimiento) })),
    ultimasAsistencias: dto.ultimasAsistencias.map((f) => (f ? new Date(f) : null)),
    eventos: dto.eventos.map((e) => ({ ...e, fecha: new Date(e.fecha) })),
  };
}
