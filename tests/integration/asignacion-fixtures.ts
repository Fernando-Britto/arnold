import { prisma } from "@/lib/db";

export const AHORA = new Date("2026-10-26T10:00:00.000Z");
export const minutos = (n: number) => new Date(AHORA.getTime() - n * 60_000);

export interface Escenario {
  socioId: string;
  usuarioId: string;
  ejercicioId: string;
  maquinaIds: string[];
  rutinaId: string;
  rutinaAsignadaId: string;
}

let secuencia = 0;

/**
 * Ids creados por esta suite. La limpieza borra solo estos: un `deleteMany` global choca con filas
 * de otras suites (por ejemplo `Asistencia_socioId_fkey`) y depende del orden de ejecución.
 */
const creados = {
  usuarios: [] as string[],
  socios: [] as string[],
  ejercicios: [] as string[],
  maquinas: [] as string[],
  rutinas: [] as string[],
  sesiones: [] as string[],
};

function registrar(clave: keyof typeof creados, id: string): void {
  creados[clave].push(id);
}

export async function crearSocio(nombre: string): Promise<{ socioId: string; usuarioId: string }> {
  const n = ++secuencia;
  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email: `${nombre.toLowerCase().replace(/\s+/g, "")}${n}@arnold.test`,
      password: "hash-de-prueba",
      rol: "SOCIO",
      estado: "ACTIVO",
    },
    select: { id: true },
  });
  const socio = await prisma.socio.create({
    data: { usuarioId: usuario.id, dni: String(30000000 + n) },
    select: { id: true },
  });
  registrar("usuarios", usuario.id);
  registrar("socios", socio.id);
  return { socioId: socio.id, usuarioId: usuario.id };
}

/** Crea un ejercicio con sus máquinas candidatas, una rutina con ese ejercicio y su asignación activa. */
export async function crearEscenario(opciones: {
  nombre: string;
  maquinas: number;
  series?: number;
  descanso?: number;
}): Promise<Escenario> {
  const { socioId, usuarioId } = await crearSocio(opciones.nombre);
  const n = ++secuencia;

  const ejercicio = await prisma.ejercicio.create({
    data: {
      nombre: `Ejercicio ${n}`,
      grupoMuscular: "Piernas",
      equipamiento: "MAQUINA_GUIADA",
    },
    select: { id: true },
  });
  registrar("ejercicios", ejercicio.id);

  const maquinaIds: string[] = [];
  for (let i = 0; i < opciones.maquinas; i += 1) {
    const maquina = await prisma.maquina.create({
      data: {
        nombre: `Maquina ${n}-${i}`,
        ubicacion: "Sala principal",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      },
      select: { id: true },
    });
    maquinaIds.push(maquina.id);
    registrar("maquinas", maquina.id);
    await prisma.ejercicioMaquina.create({
      data: { ejercicioId: ejercicio.id, maquinaId: maquina.id },
    });
  }

  const rutina = await prisma.rutina.create({
    data: {
      nombre: `Rutina ${n}`,
      objetivoPrincipal: "Fuerza",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
    },
    select: { id: true },
  });
  registrar("rutinas", rutina.id);
  await prisma.ejercicioEnRutina.create({
    data: {
      rutinaId: rutina.id,
      ejercicioId: ejercicio.id,
      series: opciones.series ?? 3,
      repeticiones: 10,
      descanso: opciones.descanso ?? 90,
      orden: 1,
    },
  });
  const rutinaAsignada = await prisma.rutinaAsignada.create({
    data: { socioId, rutinaId: rutina.id, activa: true },
    select: { id: true },
  });

  return {
    socioId,
    usuarioId,
    ejercicioId: ejercicio.id,
    maquinaIds,
    rutinaId: rutina.id,
    rutinaAsignadaId: rutinaAsignada.id,
  };
}

export async function crearSesionEnCurso(
  escenario: Escenario,
  opciones: { horaInicio: Date }
): Promise<string> {
  const sesion = await prisma.sesionDeEntrenamiento.create({
    data: {
      socioId: escenario.socioId,
      rutinaAsignadaId: escenario.rutinaAsignadaId,
      estadoDeFinalizacion: "EN_CURSO",
      horaInicio: opciones.horaInicio,
      ejercicioActualId: escenario.ejercicioId,
      serieActual: 1,
    },
    select: { id: true },
  });
  registrar("sesiones", sesion.id);
  return sesion.id;
}

export async function limpiar(): Promise<void> {
  const socios = { in: creados.socios };
  const ejercicios = { in: creados.ejercicios };
  const maquinas = { in: creados.maquinas };
  const rutinas = { in: creados.rutinas };
  const sesiones = { in: creados.sesiones };

  // Orden de claves foráneas, y siempre acotado a lo que creó esta suite.
  await prisma.asignacionDeEjercicio.deleteMany({
    where: { OR: [{ socioId: socios }, { ejercicioId: ejercicios }, { sesionId: sesiones }] },
  });
  await prisma.registroDeProgreso.deleteMany({
    where: { OR: [{ socioId: socios }, { sesionId: sesiones }] },
  });
  await prisma.asistencia.deleteMany({ where: { socioId: socios } });
  await prisma.sesionDeEntrenamiento.deleteMany({ where: { socioId: socios } });
  await prisma.rutinaAsignada.deleteMany({ where: { socioId: socios } });
  await prisma.ejercicioEnRutina.deleteMany({ where: { rutinaId: rutinas } });
  await prisma.rutina.deleteMany({ where: { id: rutinas } });
  await prisma.ejercicioMaquina.deleteMany({
    where: { OR: [{ maquinaId: maquinas }, { ejercicioId: ejercicios }] },
  });
  await prisma.ejercicio.deleteMany({ where: { id: ejercicios } });
  await prisma.maquina.deleteMany({ where: { id: maquinas } });
  await prisma.socio.deleteMany({ where: { id: socios } });
  await prisma.usuario.deleteMany({ where: { id: { in: creados.usuarios } } });

  for (const clave of Object.keys(creados) as Array<keyof typeof creados>) {
    creados[clave] = [];
  }
}

export const lectura = (socioId: string) => ({
  socioId,
  ahora: AHORA,
  minutosInactividadSesion: 30,
  excluirEjercicioIds: [] as string[],
});

