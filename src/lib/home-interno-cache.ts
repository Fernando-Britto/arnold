/**
 * Caché de degradación parcial de Home_Interno.
 *
 * Spec `home-interno-dashboard` §Error Handling: ante un `AGGREGATION_TIMEOUT` el panel debe
 * mostrar "cached last-known values with a staleness indicator". Guardamos el último payload
 * exitoso en `sessionStorage` (se descarta al cerrar la pestaña): no es data sensible, es el
 * resumen operativo, y así una recarga posterior que falle puede mostrar los últimos valores.
 *
 * Los tipos se importan sólo como tipo: este módulo no depende del bundle de fetch, así que
 * puede vivir junto a la página (que mockea `@/api/home-interno` en los tests).
 */
import type { HomeInternoData, HomeInternoDTO } from "@/api/home-interno";

export const HOME_INTERNO_CACHE_KEY = "home-interno:ultimo-panel";

/** Serializa a la forma de transporte (fechas ISO) para JSON. */
export function serializarHomeInterno(data: HomeInternoData): HomeInternoDTO {
  return {
    ...data,
    ahora: data.ahora.toISOString(),
    pagos: data.pagos.map((p) => ({ ...p, fecha: p.fecha.toISOString() })),
    cuotas: data.cuotas.map((c) => ({ ...c, fechaVencimiento: c.fechaVencimiento.toISOString() })),
    ultimasAsistencias: data.ultimasAsistencias.map((f) => (f ? f.toISOString() : null)),
    eventos: data.eventos.map((e) => ({ ...e, fecha: e.fecha.toISOString() })),
  };
}

/** Revive la forma de transporte (`ahora`/fechas como `Date`). */
export function hidratarHomeInterno(dto: HomeInternoDTO): HomeInternoData {
  return {
    ...dto,
    ahora: new Date(dto.ahora),
    pagos: dto.pagos.map((p) => ({ ...p, fecha: new Date(p.fecha) })),
    cuotas: dto.cuotas.map((c) => ({ ...c, fechaVencimiento: new Date(c.fechaVencimiento) })),
    ultimasAsistencias: dto.ultimasAsistencias.map((f) => (f ? new Date(f) : null)),
    eventos: dto.eventos.map((e) => ({ ...e, fecha: new Date(e.fecha) })),
  };
}

export function guardarHomeInternoCache(data: HomeInternoData): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(serializarHomeInterno(data));
    window.sessionStorage.setItem(HOME_INTERNO_CACHE_KEY, raw);
    ultimaRaw = raw;
    ultimoValor = data;
  } catch {
    // sessionStorage puede no estar disponible (modo privado, cuota): la degradación no es crítica.
  }
}

// `leerHomeInternoCache` tiene que devolver la MISMA referencia mientras no cambie el cache:
// lo consume `useSyncExternalStore`, que exige un snapshot estable.
let ultimaRaw: string | null = null;
let ultimoValor: HomeInternoData | null = null;

export function leerHomeInternoCache(): HomeInternoData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HOME_INTERNO_CACHE_KEY);
    if (raw === ultimaRaw) return ultimoValor;
    ultimaRaw = raw;
    ultimoValor = raw ? hidratarHomeInterno(JSON.parse(raw) as HomeInternoDTO) : null;
    return ultimoValor;
  } catch {
    return null;
  }
}
