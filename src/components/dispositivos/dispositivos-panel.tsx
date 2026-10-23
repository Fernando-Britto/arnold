"use client";

import React, { useEffect, useState } from "react";
import { useNotifications } from "@/contexts/notifications";
import {
  cambiarEstadoDispositivo,
  crearDispositivo,
  fetchDispositivos,
  type DispositivoDTO,
  type TipoDispositivo,
} from "@/api/dispositivos";
import { handleApiError } from "@/utils/api-error";
import { DispositivoListPanel } from "./dispositivo-list";

const TIPOS: ReadonlyArray<{ value: TipoDispositivo; label: string }> = [
  { value: "PUERTA", label: "Puerta" },
  { value: "RECEPCION", label: "Recepción" },
];

/**
 * Panel de gestión de dispositivos (AC-11): lista, alta con token mostrado una sola vez y
 * desactivación. Sin chrome ni guardia de rol: lo montan `/dispositivos` y la pestaña
 * "Dispositivos" de `/configuracion` (ambas solo Administrador).
 */
export function DispositivosPanel() {
  const { notify } = useNotifications();

  const [dispositivos, setDispositivos] = useState<DispositivoDTO[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoDispositivo>("PUERTA");
  const [tokenCreado, setTokenCreado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [desactivandoId, setDesactivandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDispositivos()
      .then((data) => {
        if (!cancelled) setDispositivos(data);
      })
      .catch((err) => {
        if (!cancelled) setError(handleApiError(err, "No se pudieron cargar los dispositivos."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCrear = async () => {
    if (!nombre.trim()) {
      setError("El nombre del dispositivo es obligatorio.");
      return;
    }
    setError(null);
    setCreando(true);
    try {
      const { dispositivo, token } = await crearDispositivo({ nombre: nombre.trim(), tipo });
      setDispositivos((prev) => [dispositivo, ...prev]);
      // El token sólo existe en memoria acá: no se vuelve a poder recuperar.
      setTokenCreado(token);
      setNombre("");
      notify("success", "Dispositivo creado.");
    } catch (err) {
      setError(handleApiError(err, "No se pudo crear el dispositivo."));
    } finally {
      setCreando(false);
    }
  };

  const handleDesactivar = async (dispositivo: DispositivoDTO) => {
    setError(null);
    setDesactivandoId(dispositivo.id);
    try {
      const actualizado = await cambiarEstadoDispositivo(dispositivo.id, "INACTIVO");
      setDispositivos((prev) => prev.map((d) => (d.id === actualizado.id ? actualizado : d)));
      notify("success", "Dispositivo desactivado.");
    } catch (err) {
      setError(handleApiError(err, "No se pudo desactivar el dispositivo."));
    } finally {
      setDesactivandoId(null);
    }
  };

  return (
    <>
      {error && (
        <p role="alert" className="w-full max-w-lg rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-bold text-ink">Nuevo dispositivo</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-ink-soft">
            Nombre
          </label>
          <input
            id="nombre"
            data-testid="dispositivo-nombre"
            type="text"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej: Puerta principal"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tipo" className="text-sm font-medium text-ink-soft">
            Tipo
          </label>
          <select
            id="tipo"
            data-testid="dispositivo-tipo"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as TipoDispositivo)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void handleCrear()}
          disabled={creando}
          className="self-start rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
        >
          {creando ? "Creando..." : "Crear dispositivo"}
        </button>

        {tokenCreado && (
          <div role="status" className="rounded-md border border-warning bg-warning-soft p-3">
            <p className="text-sm font-medium text-warning">
              Guardá este token ahora: no se volverá a mostrar.
            </p>
            <code
              data-testid="dispositivo-token"
              className="mt-2 block break-all rounded bg-surface px-2 py-1 text-sm"
            >
              {tokenCreado}
            </code>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <p className="p-6 text-ink-muted">Cargando dispositivos...</p>
        ) : (
          <DispositivoListPanel
            dispositivos={dispositivos}
            onDesactivar={(d) => void handleDesactivar(d)}
            desactivandoId={desactivandoId}
          />
        )}
      </section>
    </>
  );
}
