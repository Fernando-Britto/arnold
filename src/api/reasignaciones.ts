/**
 * Reasignación por instructor (P-61): lectura de sesiones en curso y cambio de máquina.
 *
 * El recurso es propio (`/api/reasignaciones`) para que la matriz de permisos por prefijo quede exacta
 * (D-132). La lógica de la reasignación vive en `src/domains/asignacion/reasignacion.ts`; acá solo se
 * consulta, se valida el rol y se mapean los resultados a HTTP.
 */
import { reasignarMaquina, type CodigoReasignacion, type PuertoReasignacion } from "@/domains/asignacion/reasignacion";

export interface CandidatoDeMaquinaDTO {
  id: string;
  nombre: string;
  estado: string;
}

export interface SesionEnCursoStaffDTO {
  sesionId: string;
  socioId: string;
  socioNombre: string;
  horaInicio: string;
  ejercicioId: string;
  ejercicioNombre: string;
  asignacionId: string | null;
  maquinaId: string | null;
  maquinaNombre: string | null;
  candidatos: CandidatoDeMaquinaDTO[];
}

export interface RespuestaReasignacionDTO {
  asignacionId: string;
  maquinaId: string;
  maquinaNombre: string | null;
}

export interface ErrorBody {
  code: string;
  message: string;
}

export type ResultadoReasignacionHttp =
  | { status: 200; body: RespuestaReasignacionDTO }
  | { status: number; body: ErrorBody };

/** Forma mínima del cliente Prisma que usa la lectura. */
export interface DbReasignaciones {
  sesionDeEntrenamiento: { findMany(args: unknown): Promise<unknown[]> };
  asignacionDeEjercicio: { findMany(args: unknown): Promise<unknown[]> };
  ejercicio: { findMany(args: unknown): Promise<unknown[]> };
  ejercicioMaquina: { findMany(args: unknown): Promise<unknown[]> };
}

interface FilaSesion {
  id: string;
  socioId: string;
  horaInicio: Date;
  ejercicioActualId: string | null;
  socio?: { usuario?: { nombre?: string | null } | null } | null;
}

interface FilaEjecucion {
  id: string;
  sesionId: string | null;
  ejercicioId: string;
  maquinaId: string | null;
}

interface FilaCandidata {
  ejercicioId: string;
  maquina: { id: string; nombre: string; estado: string } | null;
}

async function clientePorDefecto(): Promise<DbReasignaciones> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as DbReasignaciones;
}

/** `GET /api/reasignaciones` — sesiones abiertas con su ejecución actual y las candidatas del ejercicio. */
export async function handleSesionesEnCursoStaff(
  db?: DbReasignaciones
): Promise<SesionEnCursoStaffDTO[]> {
  const cliente = db ?? (await clientePorDefecto());

  const sesiones = (await cliente.sesionDeEntrenamiento.findMany({
    where: { estadoDeFinalizacion: "EN_CURSO", ejercicioActualId: { not: null } },
    orderBy: { horaInicio: "asc" },
    select: {
      id: true,
      socioId: true,
      horaInicio: true,
      ejercicioActualId: true,
      socio: { select: { usuario: { select: { nombre: true } } } },
    },
  })) as FilaSesion[];

  if (sesiones.length === 0) return [];

  const sesionIds = sesiones.map((s) => s.id);
  const ejercicioIds = [
    ...new Set(sesiones.map((s) => s.ejercicioActualId).filter((id): id is string => id !== null)),
  ];

  const [ejecuciones, ejercicios, candidatas] = await Promise.all([
    cliente.asignacionDeEjercicio.findMany({
      where: { sesionId: { in: sesionIds }, estado: "EN_CURSO" },
      orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
      select: { id: true, sesionId: true, ejercicioId: true, maquinaId: true },
    }) as Promise<FilaEjecucion[]>,
    cliente.ejercicio.findMany({
      where: { id: { in: ejercicioIds } },
      select: { id: true, nombre: true },
    }) as Promise<{ id: string; nombre: string }[]>,
    cliente.ejercicioMaquina.findMany({
      where: { ejercicioId: { in: ejercicioIds } },
      select: { ejercicioId: true, maquina: { select: { id: true, nombre: true, estado: true } } },
    }) as Promise<FilaCandidata[]>,
  ]);

  // La fila EN_CURSO más reciente por sesión (mismo criterio que `aplicarOcupantes`).
  const porSesion = new Map<string, FilaEjecucion>();
  for (const fila of ejecuciones) {
    if (!fila.sesionId || porSesion.has(fila.sesionId)) continue;
    porSesion.set(fila.sesionId, fila);
  }

  const nombreDeEjercicio = new Map(ejercicios.map((e) => [e.id, e.nombre]));
  const candidatasPorEjercicio = new Map<string, CandidatoDeMaquinaDTO[]>();
  for (const fila of candidatas) {
    if (!fila.maquina) continue;
    const lista = candidatasPorEjercicio.get(fila.ejercicioId) ?? [];
    lista.push({ id: fila.maquina.id, nombre: fila.maquina.nombre, estado: fila.maquina.estado });
    candidatasPorEjercicio.set(fila.ejercicioId, lista);
  }

  return sesiones.flatMap((sesion) => {
    const ejercicioId = sesion.ejercicioActualId;
    if (!ejercicioId) return [];
    const ejecucion = porSesion.get(sesion.id);
    const candidatos = candidatasPorEjercicio.get(ejercicioId) ?? [];
    const maquinaId = ejecucion?.maquinaId ?? null;

    return [
      {
        sesionId: sesion.id,
        socioId: sesion.socioId,
        socioNombre: sesion.socio?.usuario?.nombre ?? "Socio",
        horaInicio: sesion.horaInicio.toISOString(),
        ejercicioId,
        ejercicioNombre: nombreDeEjercicio.get(ejercicioId) ?? "Ejercicio",
        asignacionId: ejecucion?.id ?? null,
        maquinaId,
        maquinaNombre: candidatos.find((c) => c.id === maquinaId)?.nombre ?? null,
        candidatos,
      },
    ];
  });
}

const MENSAJES: Record<CodigoReasignacion, { status: number; message: string }> = {
  ASIGNACION_NO_ENCONTRADA: { status: 404, message: "No encontramos esa ejecución en curso" },
  ASIGNACION_YA_TERMINADA: { status: 409, message: "El socio ya terminó ese ejercicio" },
  MAQUINA_NO_CANDIDATA: { status: 409, message: "Esa máquina no es una opción para este ejercicio" },
  MAQUINA_NO_DISPONIBLE: { status: 409, message: "Esa máquina no está disponible" },
  MAQUINA_OCUPADA: { status: 409, message: "Esa máquina está ocupada" },
};

/** Body estricto: objeto plano con `asignacionId` y `maquinaId` y nada más. */
export function leerBodyReasignacion(
  body: unknown
): { asignacionId: string; maquinaId: string } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const claves = Object.keys(body);
  if (claves.length !== 2) return null;
  const { asignacionId, maquinaId } = body as { asignacionId?: unknown; maquinaId?: unknown };
  if (typeof asignacionId !== "string" || !asignacionId) return null;
  if (typeof maquinaId !== "string" || !maquinaId) return null;
  return { asignacionId, maquinaId };
}

/** `POST /api/reasignaciones` — cambia la máquina de una ejecución EN_CURSO. */
export async function handleReasignar(solicitud: {
  body: unknown;
  responsableId: string;
  ahora: Date;
  puerto?: PuertoReasignacion;
}): Promise<ResultadoReasignacionHttp> {
  const datos = leerBodyReasignacion(solicitud.body);
  if (!datos) {
    return {
      status: 400,
      body: { code: "VALIDATION_ERROR", message: "La solicitud no es válida: se espera asignacionId y maquinaId" },
    };
  }

  const puerto =
    solicitud.puerto ??
    (await import("@/domains/asignacion/asignacion-repositorio")).reasignacionPuerto;

  try {
    const resultado = await reasignarMaquina(
      {
        asignacionId: datos.asignacionId,
        maquinaDestinoId: datos.maquinaId,
        responsableId: solicitud.responsableId,
        ahora: solicitud.ahora,
      },
      puerto
    );

    if (resultado.tipo === "error") {
      const { status, message } = MENSAJES[resultado.codigo];
      return { status, body: { code: resultado.codigo, message } };
    }

    return {
      status: 200,
      body: {
        asignacionId: resultado.asignacionId,
        maquinaId: resultado.maquinaId,
        maquinaNombre: resultado.maquinaNombre,
      },
    };
  } catch (error) {
    console.error("[REASIGNACION]", { asignacionId: datos.asignacionId, error });
    return { status: 500, body: { code: "SERVER_ERROR", message: "No se pudo reasignar la máquina" } };
  }
}
