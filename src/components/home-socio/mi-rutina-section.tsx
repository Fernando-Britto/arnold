"use client";

import React from "react";
import { Clock, Dumbbell, Play } from "lucide-react";
import type { RutinaSeccionDTO, SesionHistorialDTO, SesionEnCursoDTO } from "@/api/home-socio-secciones";
import { AtribucionMedia, EjercicioMiniatura } from "@/components/ejercicio-crud/ejercicio-media";

/**
 * MiRutinaSection (T-039, D-45): rutina asignada con su prescripción, historial de sesiones
 * y forma de retomar una sesión en curso. Solo datos del socio (los resuelve el servidor).
 */
export interface MiRutinaSectionProps {
  rutina: RutinaSeccionDTO | null;
  sesiones: SesionHistorialDTO[];
  sesionEnCurso: SesionEnCursoDTO | null;
  onSeguirRutina?: () => void;
  onVerEjercicios?: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  INCOMPLETA: "Incompleta",
  ABANDONADA: "Abandonada",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

export function MiRutinaSection({
  rutina,
  sesiones,
  sesionEnCurso,
  onSeguirRutina,
  onVerEjercicios,
}: MiRutinaSectionProps) {
  // Si algún ejercicio tiene animación, todas las filas reservan el lugar de la miniatura (alineadas).
  const hayMedia = rutina?.ejercicios.some((e) => e.mediaId) ?? false;
  return (
    <section aria-labelledby="mi-rutina-titulo" className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-brand" aria-hidden="true" />
            <h1 id="mi-rutina-titulo" className="text-xl font-bold text-ink">
              {rutina ? rutina.nombre : "Mi rutina"}
            </h1>
          </div>
          {rutina && onVerEjercicios && (
            <button
              type="button"
              onClick={onVerEjercicios}
              className="text-sm font-bold text-brand"
            >
              Ver mis ejercicios →
            </button>
          )}
        </div>

        {!rutina ? (
          <p className="text-sm text-ink-muted">Todavía no tenés una rutina asignada.</p>
        ) : (
          <>
            {sesionEnCurso && (
              <div className="flex items-center justify-between rounded-2xl bg-orange-50 p-4">
                <p className="text-sm font-medium text-ink-soft">
                  Tenés una sesión sin terminar
                  {sesionEnCurso.serieActual ? ` (serie ${sesionEnCurso.serieActual})` : ""}.
                </p>
                <button
                  type="button"
                  onClick={onSeguirRutina}
                  className="flex items-center gap-2 rounded-lg bg-brand-strong px-4 py-2 text-sm font-bold text-surface"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Retomar sesión
                </button>
              </div>
            )}

            <ul className="flex flex-col divide-y divide-zinc-100">
              {rutina.ejercicios.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {hayMedia && <EjercicioMiniatura mediaId={e.mediaId} />}
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">{e.nombre}</span>
                      <span className="text-xs text-ink-muted">{e.grupoMuscular}</span>
                    </div>
                  </div>
                  <span className="text-sm text-ink-muted">
                    {e.series} × {e.repeticiones}
                    <span className="ml-3 inline-flex items-center gap-1 text-ink-muted">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {e.descanso}s
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {hayMedia && <AtribucionMedia />}

            {onSeguirRutina && !sesionEnCurso && (
              <button
                type="button"
                onClick={onSeguirRutina}
                className="w-fit rounded-lg bg-brand-strong px-5 py-3 text-sm font-bold text-surface"
              >
                Seguir rutina
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-bold text-ink">Historial de sesiones</h2>
        {sesiones.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no registraste sesiones.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {sesiones.map((s) => (
              <li key={s.id} data-testid="sesion-historial" className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-soft">{formatFecha(s.horaInicio)}</span>
                <span className="text-xs font-medium text-ink-muted">
                  {ESTADO_LABEL[s.estado] ?? s.estado}
                </span>
                <span className="text-sm text-ink-muted">
                  {s.duracionMin !== null ? `${s.duracionMin} min` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
