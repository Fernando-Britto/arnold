/**
 * Contrato de navegación del socio.
 *
 * La barra horizontal que vivía acá se reemplazó por `socio-rail.tsx`. Este módulo conserva lo
 * único que sigue siendo compartido: las claves de sección y el mapeo a ruta, que usan el rail,
 * el marco de las secciones y sus tests.
 */
export type TopNavLink = "inicio" | "rutina" | "ejercicios" | "progreso" | "membresia" | "asistencias";

const HREFS: Record<TopNavLink, string> = {
  inicio: "/home-socio",
  rutina: "/home-socio/mi-rutina",
  ejercicios: "/home-socio/mis-ejercicios",
  progreso: "/home-socio/progreso",
  membresia: "/home-socio/mi-membresia",
  asistencias: "/home-socio/mis-asistencias",
};

/** Ruta de cada sección del socio (T-039). */
export function topNavHref(link: TopNavLink): string {
  return HREFS[link];
}
