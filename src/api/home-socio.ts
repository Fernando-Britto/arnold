/**
 * Client-side data access for Home_Socio.
 * Spec: openspec/specs/home-socio-portal/spec.md
 * Shapes updated to match the real design (Home_Socio_1x): single-exercise
 * progression with PR + suggested next session, hourly occupancy chart,
 * weekly streak, and a 28-day attendance grid.
 *
 * NOTE — scope boundary (documented, not hidden): `/api/home-socio` does
 * NOT exist yet. Building it for real needs a repository/aggregation layer
 * over Asistencia (by hour, by day), RegistroDeProgreso (per exercise, with
 * a next-session suggestion algorithm), SesionDeEntrenamiento,
 * RutinaAsignada and Cuota — none of which have a domain layer today. This
 * module exists so the page can be built and fully tested now against a
 * mocked `fetchHomeSocioData`.
 */

export interface PuntoProgresoDTO {
  fecha: string; // ISO date
  carga: number; // kg
}

export interface ProgresoActualDTO {
  ejercicioNombre: string;
  marcaActual: number;
  deltaEsteMes: number;
  progresionCarga: PuntoProgresoDTO[];
  proximaSesionSugerida: number;
}

export interface HoraOcupacionDTO {
  hora: number; // 0-23
  ocupacion: number;
}

export interface AforoDTO {
  ocupacionActual: number;
  capacidadMaxima: number;
  horas: HoraOcupacionDTO[];
  horaActual: number;
}

export interface EjercicioEnRutinaDTO {
  id: string;
  nombre: string;
  grupoMuscular: string;
  descripcion: string | null;
  series: number;
  repeticiones: number;
  descanso: number;
}

export interface RutinaActivaDTO {
  nombre: string;
  /**
   * Full detail per exercise, in routine order. Deliberately NOT split into
   * a separate "thumb" (id/nombre only) + "current exercise detail" shape:
   * if the Socio advances locally to the next exercise, Tarjeta_Detalle
   * needs real series/reps/descripción for whichever exercise becomes
   * current, not just its name.
   */
  ejercicios: EjercicioEnRutinaDTO[];
  indiceActual: number;
}

export interface RachaDTO {
  semanasRacha: number;
  /** Exactly 7 entries, Monday first, for the current calendar week. */
  dias: { numero: number; asistio: boolean; esHoy: boolean }[];
}

export interface MembresiaDTO {
  planNombre: string;
  /** ISO date string. */
  fechaVencimiento: string;
  diasTotalMembresia: number;
  /** 4 weeks × 7 days = 28 entries, oldest to newest. */
  dias28: boolean[];
  totalAsistencias28Dias: number;
}

export interface HomeSocioViewModel {
  progreso: ProgresoActualDTO | null;
  aforo: AforoDTO;
  rutinaActiva: RutinaActivaDTO | null;
  sesionEnProgreso: boolean;
  racha: RachaDTO;
  membresia: MembresiaDTO | null;
}

export async function fetchHomeSocioData(): Promise<HomeSocioViewModel> {
  const response = await fetch("/api/home-socio");
  if (!response.ok) {
    throw new Error(`Failed to fetch home-socio data: ${response.statusText}`);
  }
  return response.json();
}
