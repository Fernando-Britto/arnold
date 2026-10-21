import path from "path";

/** Lo que el conversor necesita del sistema (el CLI pasa el real; los tests, uno simulado). */
export interface DepsMedia {
  existe(ruta: string): boolean;
  crearCarpeta(ruta: string): void;
  tamaño(ruta: string): number;
  renombrar(de: string, a: string): void;
  borrar(ruta: string): void;
  /** Ejecuta un programa; rechaza si termina con error. */
  ejecutar(comando: string, args: string[]): Promise<void>;
}

export interface OpcionesMedia {
  /** Carpeta con los GIF del dataset (`<dataset>/videos`). */
  origen: string;
  /** Carpeta de salida (`public/ejercicios`). */
  destino: string;
  /** Nombre base de cada archivo (el `mediaId` del catálogo, p. ej. "0001-2gPfomN"). */
  mediaIds: readonly string[];
  /** Reconvierte aunque el archivo ya exista. */
  forzar?: boolean;
  /** Calcula e informa sin ejecutar ni crear nada. */
  dryRun?: boolean;
  /** Conversiones simultáneas (por defecto 4). */
  concurrencia?: number;
}

export interface ResumenMedia {
  convertidos: number;
  omitidos: number;
  bytesOrigen: number;
  bytesDestino: number;
  dryRun: boolean;
}

/**
 * H.264 (lo reproduce cualquier navegador), sin audio, con `faststart` para que empiece a verse
 * antes de bajar todo, y tiempos variables para respetar la duración de cada cuadro del GIF.
 * CRF 26: en una muestra de 60 GIF bajó el peso unas 10 veces sin diferencia visible.
 */
const argsVideo = (origen: string, destino: string): string[] => [
  "-nostdin", "-loglevel", "error", "-y",
  "-i", origen,
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", // yuv420p exige dimensiones pares (los GIF del dataset ya son 180×180)
  "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-an", "-fps_mode", "vfr",
  destino,
];

/** Miniatura = primer cuadro del GIF: sirve de póster y para los listados, sin cargar el video. */
const argsMiniatura = (origen: string, destino: string): string[] => [
  "-nostdin", "-loglevel", "error", "-y", "-i", origen, "-frames:v", "1", "-q:v", "6", destino,
];

/**
 * Convierte los GIF del catálogo a mp4 + miniatura jpg (T-050d, D-70). Repetible y a prueba de
 * cortes: ffmpeg escribe a un nombre temporal que se renombra recién al terminar, así que un
 * archivo a medias nunca se confunde con uno bueno en la corrida siguiente.
 */
export async function convertirMedia(deps: DepsMedia, opciones: OpcionesMedia): Promise<ResumenMedia> {
  const { origen, destino, mediaIds } = opciones;
  const gif = (id: string) => path.join(origen, `${id}.gif`);

  const faltantes = mediaIds.filter((id) => !deps.existe(gif(id)));
  if (faltantes.length > 0) {
    throw new Error(`Faltan ${faltantes.length} GIF en ${origen}: ${faltantes.join(", ")}`);
  }

  type Tarea = { id: string; salida: string; armarArgs: (o: string, d: string) => string[] };
  const tareas: Tarea[] = [];
  let omitidos = 0;
  for (const id of mediaIds) {
    const mp4 = path.join(destino, `${id}.mp4`);
    const jpg = path.join(destino, `${id}.jpg`);
    const pendientes: Tarea[] = [];
    if (opciones.forzar || !deps.existe(mp4)) pendientes.push({ id, salida: mp4, armarArgs: argsVideo });
    if (opciones.forzar || !deps.existe(jpg)) pendientes.push({ id, salida: jpg, armarArgs: argsMiniatura });
    if (pendientes.length === 0) omitidos++;
    tareas.push(...pendientes);
  }
  const convertidos = new Set(tareas.map((t) => t.id)).size;

  const bytesOrigen = mediaIds.reduce((suma, id) => suma + deps.tamaño(gif(id)), 0);
  if (opciones.dryRun) return { convertidos, omitidos, bytesOrigen, bytesDestino: 0, dryRun: true };

  if (tareas.length > 0) deps.crearCarpeta(destino);

  const hacer = async ({ id, salida, armarArgs }: Tarea) => {
    const ext = path.extname(salida);
    const temporal = salida.slice(0, -ext.length) + ".tmp" + ext;
    try {
      await deps.ejecutar("ffmpeg", armarArgs(gif(id), temporal));
      deps.renombrar(temporal, salida);
    } catch (error) {
      if (deps.existe(temporal)) deps.borrar(temporal);
      throw new Error(`No se pudo convertir ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Pool simple: `concurrencia` trabajadores sacan tareas de la misma cola.
  const cola = [...tareas];
  const trabajador = async () => {
    for (let t = cola.shift(); t; t = cola.shift()) await hacer(t);
  };
  await Promise.all(Array.from({ length: Math.max(1, opciones.concurrencia ?? 4) }, trabajador));

  const bytesDestino = mediaIds.reduce(
    (suma, id) => suma + deps.tamaño(path.join(destino, `${id}.mp4`)) + deps.tamaño(path.join(destino, `${id}.jpg`)),
    0
  );
  return { convertidos, omitidos, bytesOrigen, bytesDestino, dryRun: false };
}
