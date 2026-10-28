/**
 * Adaptador sesión ↔ asignaciones (T-056g, CP4c).
 *
 * Recibe el cliente Prisma o la transacción ya cargado: el llamante resuelve la conexión.
 * La guarda de capacidad (D-103) es la única puerta: sin los modelos nuevos todo es no-op y la
 * sesión se comporta como siempre.
 */

interface AsignacionDeEjercicioApi {
  findFirst(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  create(args: unknown): Promise<unknown>;
}

export interface ClienteConAsignaciones {
  asignacionDeEjercicio: AsignacionDeEjercicioApi;
  ejercicioMaquina: { findMany(args: unknown): Promise<unknown[]> };
}

export function esClienteConAsignaciones(db: unknown): db is ClienteConAsignaciones {
  if (typeof db !== "object" || db === null) return false;
  const cliente = db as Record<string, unknown>;
  const asignacion = cliente.asignacionDeEjercicio as Record<string, unknown> | undefined;
  const ejercicioMaquina = cliente.ejercicioMaquina as Record<string, unknown> | undefined;
  return (
    typeof asignacion?.findFirst === "function" &&
    typeof asignacion?.updateMany === "function" &&
    typeof asignacion?.create === "function" &&
    typeof ejercicioMaquina?.findMany === "function"
  );
}

export interface ReservaParaSesion {
  id: string;
  ejercicioId: string;
  maquinaId: string;
}

/** Reserva `RESERVADA` no vencida del socio, la más reciente. */
export async function leerReservaVigenteParaSesion(
  db: ClienteConAsignaciones,
  socioId: string,
  ahora: Date
): Promise<ReservaParaSesion | null> {
  const fila = (await db.asignacionDeEjercicio.findFirst({
    where: { socioId, estado: "RESERVADA", venceEn: { gt: ahora }, maquinaId: { not: null } },
    orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
    select: { id: true, ejercicioId: true, maquinaId: true },
  })) as ReservaParaSesion | null;

  return fila;
}

/** Guard optimista: solo consume si sigue `RESERVADA` y no venció. */
export async function consumirReservaParaSesion(
  tx: ClienteConAsignaciones,
  reservaId: string,
  sesionId: string,
  ahora: Date
): Promise<boolean> {
  const { count } = await tx.asignacionDeEjercicio.updateMany({
    where: { id: reservaId, estado: "RESERVADA", venceEn: { gt: ahora } },
    data: { estado: "EN_CURSO", sesionId },
  });
  return count === 1;
}

/** `maquinaId` de la fila `EN_CURSO`: la única candidata, o `null` con cero o varias (D-108). */
export async function maquinaUnicaDe(
  db: ClienteConAsignaciones,
  ejercicioId: string
): Promise<string | null> {
  const filas = (await db.ejercicioMaquina.findMany({
    where: { ejercicioId },
    select: { maquinaId: true },
  })) as Array<{ maquinaId: string }>;

  return filas.length === 1 ? filas[0].maquinaId : null;
}

/**
 * Recálculo posterior a un cambio de sesión. Best-effort: cualquier fallo se loguea y no revierte
 * nada. La orquestación entra por `import()` dinámico para no arrastrar la capa de datos.
 */
export async function recalcularTrasSesion(input: {
  socioId: string;
  ahora: Date;
  excluirEjercicioIds: string[];
}): Promise<void> {
  try {
    const { calcularYReservar } = await import("@/domains/asignacion/orquestacion");
    await calcularYReservar({
      socioId: input.socioId,
      ahora: input.ahora,
      momento: "INICIO_RUTINA",
      excluirEjercicioIds: input.excluirEjercicioIds,
    });
  } catch (error) {
    console.error("[ASIGNACION][sesion]", {
      socioId: input.socioId,
      tipo: "error-no-contenido",
      error,
    });
  }
}

/** Fila `EN_CURSO` del ejercicio que arranca sin reserva. Snapshot 0/0 (D-108). */
export async function crearEjecucionParaSesion(
  tx: ClienteConAsignaciones,
  datos: {
    socioId: string;
    sesionId: string;
    ejercicioId: string;
    maquinaId: string | null;
    ahora: Date;
  }
): Promise<void> {
  await tx.asignacionDeEjercicio.create({
    data: {
      socioId: datos.socioId,
      sesionId: datos.sesionId,
      ejercicioId: datos.ejercicioId,
      maquinaId: datos.maquinaId,
      estado: "EN_CURSO",
      esperaSegundos: 0,
      ahorroSegundos: 0,
      creadaEn: datos.ahora,
      // `venceEn` es NOT NULL; el vencimiento solo aplica a RESERVADA.
      venceEn: datos.ahora,
    },
  });
}
