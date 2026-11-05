/**
 * Tema claro/oscuro: la preferencia vive en la cookie `tema` (un año, por dispositivo).
 * Sin cookie, el primer arranque sigue a `prefers-color-scheme`. El atributo `data-tema`
 * en <html> es la única fuente de verdad para CSS y para el selector.
 */
export type Tema = "claro" | "oscuro";

export const COOKIE_TEMA = "tema";
const UN_ANIO_SEGUNDOS = 60 * 60 * 24 * 365;

/** Script inline del root layout: corre antes del primer paint y evita el flash. */
export const SCRIPT_TEMA = `(function(){try{var m=document.cookie.match(/(?:^|; )tema=(claro|oscuro)/);var t=m?m[1]:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro");document.documentElement.dataset.tema=t}catch(e){}})();`;

export function temaActual(): Tema {
  return document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro";
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=${UN_ANIO_SEGUNDOS}; samesite=lax`;
}

export function alternarTema(): void {
  aplicarTema(temaActual() === "oscuro" ? "claro" : "oscuro");
}
