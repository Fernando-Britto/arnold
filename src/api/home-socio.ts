/**
 * Client-side data access for Home_Socio.
 * Spec: openspec/specs/home-socio-portal/spec.md
 * Shapes updated to match the real design (Home_Socio_1x): single-exercise
 * progression with PR + suggested next session, hourly occupancy chart,
 * weekly streak, and a 28-day attendance grid.
 *
 * The server side lives in src/api/home-socio-data.ts (payload from Prisma) and
 * src/app/api/home-socio/route.ts (GET /api/home-socio, T-028 / D-29). This
 * module is the wire contract plus the client-side fetch.
 */

export interface PuntoProgresoDTO {
  fecha: string; // ISO date
  carga: number; // kg
}

/**
 * Qué cargar la próxima vez y por qué, según el motor de progresión (P-42, D-60). Es la MISMA
 * sugerencia que muestra la pantalla de entrenamiento: Home y entrenamiento no se contradicen.
 */
export interface SugerenciaProgresoDTO {
  tipo: "primera" | "subir" | "mantener" | "descargar";
  /** kg; null si no hay un número honesto que sugerir. */
  carga: number | null;
  motivo: string;
}

export interface ProgresoActualDTO {
  ejercicioNombre: string;
  marcaActual: number;
  deltaEsteMes: number;
  progresionCarga: PuntoProgresoDTO[];
  /** null si el ejercicio ya no está en la rutina activa: no hay plan contra el cual juzgarlo. */
  sugerencia: SugerenciaProgresoDTO | null;
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
  /** Base del archivo en `public/ejercicios` ("0001-2gPfomN"); null si el ejercicio no tiene media. */
  mediaId: string | null;
  grupoMuscular: string;
  descripcion: string | null;
  series: number;
  repeticiones: number;
  descanso: number;
}

export interface RutinaActivaDTO {
  nombre: string;
  /**
   * `RutinaAsignada.id` de la asignación activa. Lo necesita la pantalla de ejecución
   * (T-038) para iniciar la sesión de entrenamiento (`POST /api/sesiones`).
   */
  rutinaAsignadaId: string;
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

/**
 * Peso corporal del socio (T-048, D-65/D-66; P-47, D-68). Llegan los pesajes tal como están en la
 * base, con su `id` (hace falta para borrarlos), del más antiguo al más reciente. La tarjeta decide
 * cuáles dibujar (uno por día, el último, en hora del gimnasio) y calcula la variación y el progreso
 * hacia la meta con las mismas funciones puras que usa el servidor (`@/domains/peso`).
 */
export interface PesoDTO {
  mediciones: Array<{ id: string; fecha: string; peso: number }>;
  /** kg; `null` si no fijó una meta. */
  pesoObjetivo: number | null;
  /** Peso desde el que fijó la meta: dice si el objetivo era bajar o subir. */
  pesoInicial: number | null;
}

/**
 * Una sesión ya cerrada, tal como la muestra el historial del inicio. `volumenKg` es la suma de
 * carga × repeticiones de las series de trabajo (D-64: el calentamiento no cuenta), y
 * `duracionMin` sale de `horaFin − horaInicio`.
 */
export interface UltimaSesionDTO {
  id: string;
  /** ISO date de `horaInicio`. */
  fecha: string;
  rutinaNombre: string;
  series: number;
  volumenKg: number;
  duracionMin: number;
}

export interface HomeSocioViewModel {
  progreso: ProgresoActualDTO | null;
  aforo: AforoDTO;
  rutinaActiva: RutinaActivaDTO | null;
  sesionEnProgreso: boolean;
  racha: RachaDTO;
  membresia: MembresiaDTO | null;
  /**
   * Oferta de reactivación del propio socio (D-54): `null` si no es elegible. Solo informa el
   * porcentaje para el aviso; el descuento real se recalcula al cobrar.
   */
  oferta: { descuentoPct: number } | null;
  /** Peso corporal y meta (T-048). */
  peso: PesoDTO;
  /** Últimas sesiones cerradas, de la más reciente a la más vieja (máx. 5). */
  ultimasSesiones: UltimaSesionDTO[];
}

export async function fetchHomeSocioData(): Promise<HomeSocioViewModel> {
  const response = await fetch("/api/home-socio");
  if (!response.ok) {
    throw new Error(`Failed to fetch home-socio data: ${response.statusText}`);
  }
  return response.json();
}
