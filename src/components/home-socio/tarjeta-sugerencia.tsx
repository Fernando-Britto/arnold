"use client";

/**
 * Tarjeta "Tu próxima máquina" de la home del socio (T-057c/T-057d, S2a/S2b).
 *
 * Presentación pura: recibe el estado del hook por props, no consulta ni guarda estado.
 * El copy es el del spec (`asignacion-sugerencia-ui`), en español rioplatense y sin jerga.
 *
 * D-123: cada botón se dibuja **solo** si llega su callback, así no existen botones muertos.
 */
import React from "react";
import { SeccionCargando } from "./seccion-cargando";
import type { EstadoSugerencia } from "./use-sugerencia-asignacion";

export interface TarjetaSugerenciaProps {
  estado: EstadoSugerencia;
  /** Acciones de decisión: el cableado real llega en S3. */
  onAceptar?: () => void;
  onEsperar?: () => void;
  /** Recarga la sugerencia (`consultar` del hook). */
  onConsultar?: () => void;
  /** Arranca o retoma la rutina: la misma acción que "Seguir rutina" del hero. */
  onEmpezar?: () => void;
  /** Hay una decisión en vuelo: los botones de decisión se deshabilitan. */
  enviando?: boolean;
  /** Hay una consulta en vuelo: el botón de recarga lo muestra y se deshabilita. */
  consultando?: boolean;
}

/** Minutos estimados: se redondea hacia arriba el minuto empezado; bajo 60 s, "menos de 1 min". */
function esperaEnTexto(segundos: number): string {
  if (segundos < 60) return "menos de 1 min";
  return `${Math.ceil(segundos / 60)} min`;
}

const MARCO = "rounded-xl border border-border bg-surface p-5";
// Feedback al tocar: el hover/active con transform da la señal de que el botón respondió, incluso
// cuando la acción no cambia lo que se ve (por ejemplo, "Volver a consultar" con los mismos datos).
const BASE_BOTON =
  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm transition-transform duration-150 enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-60";
const CLASE_BOTON_PRIMARIO = `${BASE_BOTON} bg-brand-strong font-bold text-surface enabled:hover:bg-brand-deep`;
const CLASE_BOTON_SECUNDARIO = `${BASE_BOTON} border border-border bg-surface font-semibold text-ink enabled:hover:bg-surface-hover`;

export function TarjetaSugerencia({
  estado,
  onAceptar,
  onEsperar,
  onConsultar,
  onEmpezar,
  enviando = false,
  consultando = false,
}: TarjetaSugerenciaProps) {
  if (estado.tipo === "cargando") {
    return (
      <section data-testid="tarjeta-sugerencia" aria-labelledby="sugerencia-titulo" className={MARCO}>
        <h2 id="sugerencia-titulo" className="text-sm font-semibold text-ink-muted">
          Tu próxima máquina
        </h2>
        <SeccionCargando className="mt-3 h-24" />
      </section>
    );
  }

  const { tipo } = estado;
  const sugerencia = tipo === "lista" || tipo === "aceptada" ? estado.sugerencia : null;
  const siguienteEnOrden = tipo === "lista" ? estado.siguienteEnOrden : null;
  // Ambos null: sin rutina activa o sin máquinas que ofrecer. Mensaje neutro único (D-114).
  const sinDatos = tipo === "lista" && !sugerencia && !siguienteEnOrden;
  const maquina = sugerencia?.maquinaNombre ?? "tu máquina";
  const conAcciones = tipo === "lista" && sugerencia !== null;

  return (
    <section data-testid="tarjeta-sugerencia" aria-labelledby="sugerencia-titulo" className={MARCO}>
      <h2 id="sugerencia-titulo" className="text-sm font-semibold text-ink-muted">
        Tu próxima máquina
      </h2>

      <div aria-live="polite" className="mt-1.5 flex flex-col gap-1">
        {tipo === "vencida" && (
          <p className="text-sm text-ink">La reserva venció. Volvemos a consultar.</p>
        )}

        {tipo === "error" && (
          <p className="text-sm text-ink">No pudimos calcular tu próxima máquina.</p>
        )}

        {sinDatos && (
          <p className="text-sm text-ink-muted">Todavía no tenemos una sugerencia para vos.</p>
        )}

        {tipo === "aceptada" && (
          <p className="text-sm text-ink">
            Listo, te guardamos <strong className="font-semibold">{maquina}</strong> para{" "}
            <strong className="font-semibold">{estado.sugerencia.ejercicioNombre}</strong>.
          </p>
        )}

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

      {conAcciones && (onAceptar || onEsperar) && (
        <div className="mt-4 flex gap-2">
          {onAceptar && (
            <button type="button" onClick={onAceptar} disabled={enviando} className={CLASE_BOTON_PRIMARIO}>
              Ir ahora
            </button>
          )}
          {onEsperar && (
            <button type="button" onClick={onEsperar} disabled={enviando} className={CLASE_BOTON_SECUNDARIO}>
              Esperar
            </button>
          )}
        </div>
      )}

      {tipo === "aceptada" && onEmpezar && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onEmpezar} className={CLASE_BOTON_PRIMARIO}>
            Empezar entrenamiento
          </button>
        </div>
      )}

      {tipo !== "aceptada" && !conAcciones && onConsultar && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onConsultar}
            disabled={consultando}
            className={CLASE_BOTON_SECUNDARIO}
          >
            {consultando ? "Consultando…" : tipo === "error" ? "Reintentar" : "Volver a consultar"}
          </button>
        </div>
      )}
    </section>
  );
}
