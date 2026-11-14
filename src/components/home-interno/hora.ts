import { GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";

/**
 * Hora del gimnasio (HH:MM) para fechas que llegan del servidor. Se formatea una fecha fija: no lee el
 * reloj, así que es seguro en render (P-57).
 */
const formateador = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: GYM_TIME_ZONE,
});

export function formatHora(iso: string): string {
  return formateador.format(new Date(iso));
}
