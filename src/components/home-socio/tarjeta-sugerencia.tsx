"use client";

/**
 * Tarjeta "Tu próxima máquina" de la home del socio (T-057c, S2a).
 *
 * Presentación pura: recibe el estado del hook por props, no consulta ni guarda estado. Solo cubre los
 * estados con datos — `libre`, `enEspera` y `sinReserva`—; los vacíos y de error son de S2b.
 * El copy es el del spec (`asignacion-sugerencia-ui`), en español rioplatense y sin jerga.
 */
import React from "react";
import type { EstadoSugerencia } from "./use-sugerencia-asignacion";

export interface TarjetaSugerenciaProps {
  estado: EstadoSugerencia;
  /** Cableado real en S3; acá solo se dibujan los botones. */
  onAceptar?: () => void;
  onEsperar?: () => void;
}

/** Minutos estimados: se redondea hacia arriba el minuto empezado; bajo 60 s, "menos de 1 min". */
function esperaEnTexto(segundos: number): string {
  if (segundos < 60) return "menos de 1 min";
  return `${Math.ceil(segundos / 60)} min`;
}

const CLASE_BOTON_PRIMARIO =
  "flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-strong text-sm font-bold text-surface";
const CLASE_BOTON_SECUNDARIO =
  "flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-ink";

export function TarjetaSugerencia({ estado, onAceptar, onEsperar }: TarjetaSugerenciaProps) {
  // `cargando` y `error` llegan en S2b; `lista` sin reserva ni orden tampoco se dibuja todavía.
  if (estado.tipo !== "lista") return null;

  const { sugerencia, siguienteEnOrden } = estado;
  const maquina = sugerencia?.maquinaNombre ?? "tu máquina";
  const conAcciones = sugerencia !== null;

  if (!sugerencia && !siguienteEnOrden) return null;

  return (
    <section
      data-testid="tarjeta-sugerencia"
      aria-labelledby="sugerencia-titulo"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <h2 id="sugerencia-titulo" className="text-sm font-semibold text-ink-muted">
        Tu próxima máquina
      </h2>

      <div aria-live="polite" className="mt-1.5 flex flex-col gap-1">
        {sugerencia && sugerencia.esperaSegundos === 0 && (
          <>
            <p className="text-lg font-black tracking-tight text-ink">Está libre</p>
            <p className="text-sm text-ink-muted">
              Andá a <strong className="font-semibold text-ink">{maquina}</strong> y hacé{" "}
              <strong className="font-semibold text-ink">{sugerencia.ejercicioNombre}</strong>.
            </p>
          </>
        )}

        {sugerencia && sugerencia.esperaSegundos > 0 && (
          <>
            <p className="text-lg font-black tracking-tight text-ink">
              Te toca en {esperaEnTexto(sugerencia.esperaSegundos)}
            </p>
            <p className="text-sm text-ink-muted">
              <strong className="font-semibold text-ink">{sugerencia.ejercicioNombre}</strong> en{" "}
              <strong className="font-semibold text-ink">{maquina}</strong>.
            </p>
          </>
        )}

        {!sugerencia && siguienteEnOrden && (
          <>
            <p className="text-lg font-black tracking-tight text-ink">Ahora no tenés una reserva.</p>
            <p className="text-sm text-ink-muted">
              Si seguís el orden de tu rutina, toca{" "}
              <strong className="font-semibold text-ink">{siguienteEnOrden.ejercicioNombre}</strong>.
            </p>
          </>
        )}
      </div>

      {conAcciones && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onAceptar} className={CLASE_BOTON_PRIMARIO}>
            Ir ahora
          </button>
          <button type="button" onClick={onEsperar} className={CLASE_BOTON_SECUNDARIO}>
            Esperar
          </button>
        </div>
      )}
    </section>
  );
}
