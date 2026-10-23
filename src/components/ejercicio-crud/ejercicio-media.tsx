"use client";

import React, { useState, useSyncExternalStore } from "react";

/**
 * Media del catálogo de ejercicios (D-70): un mp4 optimizado y una miniatura jpg por ejercicio,
 * en `public/ejercicios/<mediaId>`. Los listados usan solo la miniatura; el video se carga al
 * abrir el ejercicio. La media es © Gym visual: dondequiera que se muestre va su atribución.
 */
export const urlVideo = (mediaId: string): string => `/ejercicios/${mediaId}.mp4`;
export const urlMiniatura = (mediaId: string): string => `/ejercicios/${mediaId}.jpg`;

const TAMAÑO_MINIATURA = 48;

/** Recuadro que ocupa el lugar de una miniatura ausente o rota (la fila no cambia de alto). */
function MiniaturaVacia() {
  return (
    <span
      data-testid="miniatura-vacia"
      aria-hidden="true"
      className="inline-block shrink-0 rounded border border-border bg-surface-subtle"
      style={{ width: TAMAÑO_MINIATURA, height: TAMAÑO_MINIATURA }}
    />
  );
}

export function EjercicioMiniatura({ mediaId }: { mediaId: string | null | undefined }) {
  const [fallo, setFallo] = useState(false);
  if (!mediaId || fallo) return <MiniaturaVacia />;
  return (
    // Un <img> común y no `next/image`: los jpg ya vienen optimizados (180×180, ~3 KB) y el
    // optimizador de Next volvería a procesarlos en el servidor sin ganancia.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urlMiniatura(mediaId)}
      alt=""
      width={TAMAÑO_MINIATURA}
      height={TAMAÑO_MINIATURA}
      loading="lazy"
      onError={() => setFallo(true)}
      className="shrink-0 rounded border border-border bg-surface object-cover"
    />
  );
}

const MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";

function suscribirMovimiento(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const consulta = window.matchMedia(MOVIMIENTO_REDUCIDO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

const hayMovimientoReducido = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia(MOVIMIENTO_REDUCIDO).matches;

/** ¿El usuario pidió menos movimiento? Se actualiza si lo cambia con la página abierta. */
function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribirMovimiento, hayMovimientoReducido, () => false);
}

export function EjercicioVideo({ mediaId, nombre }: { mediaId: string | null | undefined; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  const movimientoReducido = useMovimientoReducido();

  if (!mediaId) {
    return <p className="text-sm text-ink-muted">Sin animación disponible</p>;
  }
  if (fallo) {
    // El mp4 no cargó: se muestra el primer cuadro estático.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={urlMiniatura(mediaId)} alt={`Ejercicio ${nombre}`} width={180} height={180} className="rounded border border-border bg-surface" />;
  }
  return (
    <video
      src={urlVideo(mediaId)}
      poster={urlMiniatura(mediaId)}
      aria-label={`Animación del ejercicio ${nombre}`}
      autoPlay={!movimientoReducido}
      controls={movimientoReducido}
      loop
      muted
      playsInline
      preload="metadata"
      width={180}
      height={180}
      onError={() => setFallo(true)}
      className="rounded border border-border bg-surface"
    />
  );
}

/** Atribución exigida por el titular de la media (ver D-70 y P-50). */
export function AtribucionMedia() {
  return (
    <p className="text-xs text-ink-muted">
      Animaciones ©{" "}
      <a href="https://gymvisual.com/" target="_blank" rel="noopener noreferrer" className="underline">
        Gym visual
      </a>
    </p>
  );
}
