"use client";

import React from "react";

/**
 * Pulso compartido para el contenido que depende de la base: el marco de la sección ya se
 * dibuja y solo esta área espera (mismo criterio que `home-interno`).
 */
export function SeccionCargando({ className = "h-32" }: { className?: string }) {
  return (
    <div
      data-testid="seccion-cargando"
      role="status"
      aria-busy="true"
      aria-label="Cargando contenido"
      className={`animate-pulse rounded-lg bg-surface-subtle ${className}`}
    />
  );
}
