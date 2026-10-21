/**
 * Contrato de las secciones del socio (T-039, D-45): tipos del wire y fetch del cliente.
 *
 * El servidor vive en `src/api/home-socio-secciones-data.ts` (payload desde Prisma) y
 * `src/app/api/home-socio/secciones/route.ts` (GET /api/home-socio/secciones). Cuelga de
 * `/api/home-socio`, así que la entrada de autorización ya existente cubre la ruta.
 */
export type { EstadoCuotaSocio } from "@/domains/pago/cuota";
import type { EstadoCuotaSocio } from "@/domains/pago/cuota";

export interface EjercicioDeRutinaDTO {
  id: string;
  nombre: string;
  grupoMuscular: string;
  descripcion: string | null;
  series: number;
  repeticiones: number;
  descanso: number;
  /** Mejor marca histórica (max `carga`), o null si nunca lo registró. */
  mejorMarca: number | null;
  /** Catálogo de ejercicios (D-70): vacíos en un ejercicio cargado a mano. */
  mediaId: string | null;
  equipamiento: string | null;
  musculoObjetivo: string | null;
  instrucciones: string[];
}

export interface RutinaSeccionDTO {
  nombre: string;
  rutinaAsignadaId: string;
  ejercicios: EjercicioDeRutinaDTO[];
}

export interface SesionHistorialDTO {
  id: string;
  horaInicio: string;
  horaFin: string | null;
  estado: string;
  duracionMin: number | null;
}

export interface SesionEnCursoDTO {
  id: string;
  horaInicio: string;
  ejercicioActualId: string | null;
  serieActual: number | null;
}

export interface ProgresoEjercicioDTO {
  ejercicioId: string;
  ejercicioNombre: string;
  serie: { fecha: string; carga: number }[];
  mejorMarca: number;
  delta: number;
}

export interface PagoHistorialDTO {
  id: string;
  fechaPago: string;
  monto: number;
  metodoPago: string;
  /** Período cubierto (YYYY-MM), o null si el pago no está ligado a una cuota. */
  periodo: string | null;
}

export interface MembresiaSeccionDTO {
  planNombre: string | null;
  /** Estado de pago calculado (D-40): nunca se persiste. */
  estado: EstadoCuotaSocio;
  ultimoPeriodoCubierto: string | null;
  fechaVencimiento: string | null;
  historial: PagoHistorialDTO[];
}

export interface AsistenciasSeccionDTO {
  rachaSemanas: number;
  total: number;
  /** `dias` entradas, de la más vieja a hoy. */
  dias: { fecha: string; asistio: boolean }[];
}

export interface HomeSocioSeccionesViewModel {
  rutina: RutinaSeccionDTO | null;
  sesiones: SesionHistorialDTO[];
  sesionEnCurso: SesionEnCursoDTO | null;
  ejercicios: EjercicioDeRutinaDTO[];
  progreso: ProgresoEjercicioDTO[];
  membresia: MembresiaSeccionDTO | null;
  asistencias: AsistenciasSeccionDTO;
}

export async function fetchHomeSocioSeccionesData(): Promise<HomeSocioSeccionesViewModel> {
  const response = await fetch("/api/home-socio/secciones");
  if (!response.ok) {
    throw new Error(`Failed to fetch home-socio sections: ${response.statusText}`);
  }
  return response.json();
}
