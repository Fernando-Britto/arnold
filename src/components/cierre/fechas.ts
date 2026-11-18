import { GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";

/** Fecha del gimnasio: "11/10/2026", o "11/10/2026 17:00" con hora. */
export function formatFechaCierre(iso: string, conHora = false): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
    timeZone: GYM_TIME_ZONE,
  }).format(new Date(iso));
}

/** Hora del gimnasio: "17:00". */
export function formatHoraCierre(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: GYM_TIME_ZONE,
  }).format(new Date(iso));
}
