/**
 * Balance muscular del socio, calculado desde su historial (T-051 parte 2, D-107).
 *
 * Una consulta agrupada cuenta las series de trabajo por ejercicio en el período (sin calentamientos
 * ni drop sets: no son series de la rutina, D-62 y D-67) y otra trae los músculos de esos ejercicios.
 * Lo demás es lógica pura: `volumenPorMusculo` y `armarBalance`.
 */
import { armarBalance, desdeDelPeriodo, type BalanceMuscular, type Periodo } from "./balance-muscular";
import { volumenPorMusculo, type DatosMusculares } from "./musculos";

export interface BalanceMuscularInput {
  socioId: string;
  periodo: Periodo;
  /** Inyectable en tests; en producción es `new Date()`. */
  ahora?: Date;
}

export async function balanceMuscularDelSocio(input: BalanceMuscularInput): Promise<BalanceMuscular> {
  const { prisma } = await import("@/lib/db");
  const desde = desdeDelPeriodo(input.periodo, input.ahora ?? new Date());

  const grupos = await prisma.registroDeProgreso.groupBy({
    by: ["ejercicioId"],
    where: {
      socioId: input.socioId,
      ...(desde ? { fecha: { gte: desde } } : {}),
      // Solo las series de la rutina: ni calentamientos ni drop sets.
      tipo: { notIn: ["CALENTAMIENTO", "DROP_SET"] },
    },
    _count: { _all: true },
  });

  if (grupos.length === 0) {
    return armarBalance({}, { periodo: input.periodo, desde, totalSeries: 0 });
  }

  const ejercicios = await prisma.ejercicio.findMany({
    where: { id: { in: grupos.map((g) => g.ejercicioId) } },
    select: { id: true, grupoMuscular: true, musculoObjetivo: true, musculosSecundarios: true },
  });
  const porId = new Map(ejercicios.map((e) => [e.id, e as DatosMusculares]));

  const entradas = grupos.flatMap((g) => {
    const ejercicio = porId.get(g.ejercicioId);
    return ejercicio ? [{ ejercicio, series: g._count._all }] : [];
  });

  // El cardio no es trabajo de fuerza: no suma músculos (D-71) ni cuenta en el total de series.
  const totalSeries = entradas
    .filter((e) => e.ejercicio.grupoMuscular !== "Cardio")
    .reduce((suma, e) => suma + e.series, 0);

  return armarBalance(volumenPorMusculo(entradas), { periodo: input.periodo, desde, totalSeries });
}
