"use client";

/**
 * Token del dispositivo (T-036) — DECISIÓN DE SEGURIDAD (M), riesgo aceptado.
 *
 * El token se guarda en `localStorage`, que en teoría es legible por XSS. Se evaluó moverlo a
 * una cookie HttpOnly puesta por el servidor, pero eso rompe el flujo actual: la página /puerta
 * decide "mostrar alta vs. kiosco" leyendo el token desde el cliente (`useTokenDispositivo`), y
 * con HttpOnly el JS no puede saber si ya hay token (habría que rediseñar el estado de la
 * pantalla y depender de un 401 del kiosco para volver al alta). Es un cambio más grande y más
 * riesgoso que el propio riesgo, que está acotado:
 *   1. La tablet de la puerta es un dispositivo físico controlado, sin navegación a sitios de
 *      terceros ni sesión de usuario; la superficie de XSS es mínima.
 *   2. El token es revocable del lado del servidor (estado ACTIVO/INACTIVO) y su hash, no el
 *      token, es lo único persistido en la base.
 *   3. En caso de compromiso, se re-provisiona el dispositivo con un token nuevo.
 * Regla derivada: el token NUNCA debe loguearse ni exponerse fuera de `localStorage` (ver
 * `setup-dispositivo.test.tsx`). Si en el futuro se rediseña el estado de /puerta, migrar a
 * cookie HttpOnly es la mejora recomendada.
 */

import React, { useState, useSyncExternalStore } from "react";

export const TOKEN_DISPOSITIVO_STORAGE_KEY = "dispositivoToken";

/** Aviso local para que la UI reaccione a los cambios de token sin recargar (misma pestaña). */
const EVENTO_TOKEN = "dispositivo-token-cambio";
const listeners = new Set<() => void>();

function emitirCambio(): void {
  for (const listener of listeners) listener();
}

function suscribir(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener(EVENTO_TOKEN, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENTO_TOKEN, listener);
  };
}

/** Lee el token del dispositivo guardado en el navegador de la puerta. */
export function leerTokenDispositivo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_DISPOSITIVO_STORAGE_KEY);
}

export function guardarTokenDispositivo(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_DISPOSITIVO_STORAGE_KEY, token);
  emitirCambio();
}

export function borrarTokenDispositivo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_DISPOSITIVO_STORAGE_KEY);
  emitirCambio();
}

/** Token del dispositivo como estado externo: null en el servidor, el valor real al hidratar. */
export function useTokenDispositivo(): string | null {
  return useSyncExternalStore(suscribir, leerTokenDispositivo, () => null);
}

/**
 * Alta mínima del dispositivo (T-036): se pega una vez el token que devolvió el alta en
 * `/api/dispositivos` y queda en `localStorage`. No hay login de usuario en la puerta.
 */
export function SetupDispositivo({ onGuardado }: { onGuardado?: (token: string) => void }) {
  const [token, setToken] = useState("");

  const guardar = (event: React.FormEvent) => {
    event.preventDefault();
    const limpio = token.trim();
    if (!limpio) return;
    guardarTokenDispositivo(limpio);
    onGuardado?.(limpio);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-page p-6">
      <h1 className="text-2xl font-bold text-ink">Configurar dispositivo</h1>
      <p className="max-w-md text-center text-ink-muted">
        Pegá el token que se mostró al crear el dispositivo. Se guarda sólo en esta pantalla.
      </p>
      <form onSubmit={guardar} className="flex w-full max-w-md flex-col gap-3">
        <label htmlFor="token-dispositivo" className="text-sm font-medium text-ink-soft">
          Token del dispositivo
        </label>
        <input
          id="token-dispositivo"
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-ink"
        />
        <button
          type="submit"
          disabled={!token.trim()}
          className="rounded-lg bg-brand-strong px-8 py-3 text-lg font-semibold text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}
