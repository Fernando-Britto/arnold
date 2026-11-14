"use client";

/**
 * Panel "Sesiones en curso" del staff (P-61, D-126).
 *
 * Lista quién está entrenando y permite cambiar la máquina de una ejecución `EN_CURSO` sin tocar la
 * sesión del socio. Solo lo monta `Home_Interno` para INSTRUCTOR y ADMINISTRADOR. Después de cada acción
 * refresca una vez, sin polling, y el `POST` es la autoridad: si la máquina está ocupada, muestra el
 * mensaje del servidor.
 */
import React, { useCallback, useEffect, useState } from "react";
import { fetchSesionesEnCurso, reasignarMaquinaApi } from "@/api/reasignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import { SeccionCargando } from "@/components/home-socio/seccion-cargando";
import { formatHora } from "./hora";
import type { SesionEnCursoStaffDTO } from "@/api/reasignaciones";

export function SesionesEnCurso() {
  const [sesiones, setSesiones] = useState<SesionEnCursoStaffDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Record<string, string>>({});

  const cargar = useCallback(() => {
    let cancelado = false;

    fetchSesionesEnCurso()
      .then((lista) => {
        if (!cancelado) setSesiones(lista);
      })
      .catch(() => {
        if (!cancelado) setError("No pudimos cargar las sesiones en curso");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => cargar(), [cargar]);

  const reasignar = async (sesion: SesionEnCursoStaffDTO) => {
    const maquinaId =
      seleccion[sesion.sesionId] ??
      sesion.candidatos.find((c) => c.estado === "DISPONIBLE")?.id ??
      "";
    if (!sesion.asignacionId || !maquinaId || enviando) return;

    setEnviando(sesion.sesionId);
    setAviso((previo) => ({ ...previo, [sesion.sesionId]: "" }));
    try {
      await reasignarMaquinaApi(sesion.asignacionId, maquinaId);
      cargar();
    } catch (e) {
      const mensaje = e instanceof ApiError && e.status < 500 ? e.message : "No se pudo reasignar la máquina";
      setAviso((previo) => ({ ...previo, [sesion.sesionId]: mensaje }));
      cargar();
    } finally {
      setEnviando(null);
    }
  };

  return (
    <section
      aria-labelledby="sesiones-en-curso-titulo"
      data-testid="sesiones-en-curso"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="sesiones-en-curso-titulo" className="text-sm font-semibold text-ink-muted">
        Sesiones en curso
      </h2>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {error === null && sesiones === null && <SeccionCargando className="mt-3 h-16" />}

      {sesiones !== null && sesiones.length === 0 && !error && (
        <p className="mt-2 text-sm text-ink-muted">No hay sesiones en curso</p>
      )}

      {sesiones !== null && sesiones.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-border-soft">
          {sesiones.map((sesion) => {
            const nombreSelector = `máquina para ${sesion.socioNombre}`;
            return (
              <li key={sesion.sesionId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{sesion.socioNombre}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {sesion.ejercicioNombre} ·{" "}
                    {sesion.maquinaNombre ?? <span className="text-ink-disabled">Sin máquina asignada</span>} ·{" "}
                    desde {formatHora(sesion.horaInicio)}
                  </p>
                  {aviso[sesion.sesionId] && (
                    <p className="mt-1 text-xs text-danger">{aviso[sesion.sesionId]}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`maquina-${sesion.sesionId}`}>
                    {nombreSelector}
                  </label>
                  <select
                    id={`maquina-${sesion.sesionId}`}
                    aria-label={nombreSelector}
                    value={seleccion[sesion.sesionId] ?? sesion.maquinaId ?? ""}
                    onChange={(e) =>
                      setSeleccion((previo) => ({ ...previo, [sesion.sesionId]: e.target.value }))
                    }
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                  >
                    {sesion.candidatos.map((candidato) => (
                      <option
                        key={candidato.id}
                        value={candidato.id}
                        disabled={candidato.estado !== "DISPONIBLE"}
                      >
                        {candidato.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!sesion.asignacionId || enviando === sesion.sesionId}
                    onClick={() => void reasignar(sesion)}
                    className="h-9 rounded-md bg-brand-strong px-3 text-sm font-semibold text-surface transition-transform duration-150 enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-60"
                  >
                    {enviando === sesion.sesionId ? "Reasignando…" : "Reasignar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
