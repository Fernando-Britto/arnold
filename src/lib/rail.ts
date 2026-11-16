/**
 * Rail colapsado: la preferencia vive en la cookie `rail` (un año, por dispositivo) y se
 * refleja en el atributo `data-rail` de <html>. Sin cookie, el rail arranca expandido.
 * El CSS de `globals.css` decide qué se oculta; el ancho lo resuelve la misma regla, solo
 * en escritorio. Mismo patrón que `tema.ts`, por eso no hay estado React ni parpadeo.
 */
export type Rail = "expandido" | "colapsado";

export const COOKIE_RAIL = "rail";
const UN_ANIO_SEGUNDOS = 60 * 60 * 24 * 365;

/** Script inline del root layout: corre antes del primer paint y evita el saltón de ancho. */
export const SCRIPT_RAIL = `(function(){try{var m=document.cookie.match(/(?:^|; )rail=(expandido|colapsado)/);if(m)document.documentElement.dataset.rail=m[1]}catch(e){}})();`;

export function railActual(): Rail {
  return document.documentElement.dataset.rail === "colapsado" ? "colapsado" : "expandido";
}

export function alternarRail(): void {
  const siguiente: Rail = railActual() === "colapsado" ? "expandido" : "colapsado";
  document.documentElement.dataset.rail = siguiente;
  document.cookie = `${COOKIE_RAIL}=${siguiente}; path=/; max-age=${UN_ANIO_SEGUNDOS}; samesite=lax`;
}
