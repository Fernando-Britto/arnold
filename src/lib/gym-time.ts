import { GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";

/**
 * Gym-local time helpers (America/Argentina/Buenos_Aires). Pure: no Prisma, no React.
 * Shift boundaries are an assumption, the spec never defines them:
 * Mañana 06–14, Tarde 14–22, Noche 22–06.
 */
export type Turno = "MANANA" | "TARDE" | "NOCHE";

/** Hour of day (0–23) at the gym. */
export function hourInGym(d: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(d);
  return parseInt(h, 10);
}

export function turnoActual(now: Date): Turno {
  const h = hourInGym(now);
  if (h >= 6 && h < 14) return "MANANA";
  if (h >= 14 && h < 22) return "TARDE";
  return "NOCHE";
}

/** 00:00 of the gym's current calendar day. Argentina has no DST, so the offset is fixed (-03:00). */
export function startOfGymDay(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${ymd}T00:00:00-03:00`);
}
