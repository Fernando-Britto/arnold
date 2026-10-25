"use client";

import { useEffect, useState } from "react";
import { fetchMaquinaEjercicios } from "@/api/maquinas";
import type { EjercicioAsociado } from "@/domains/maquina/maquina";
import { handleApiError } from "@/utils/api-error";

export interface MaquinaExpandedRowProps {
  maquinaId: string;
  onAsignar?: (maquinaId: string) => void;
}

/**
 * Contenido de la fila desplegada de `/maquinas`. Es de sólo lectura: muestra los
 * ejercicios asociados y delega la escritura al modal de asignación vía `onAsignar`.
 * Se monta sólo cuando la fila está expandida, así la carga es perezosa.
 */
export function MaquinaExpandedRow({
  maquinaId,
  onAsignar,
}: MaquinaExpandedRowProps) {
  const [ejercicios, setEjercicios] = useState<EjercicioAsociado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetchMaquinaEjercicios(maquinaId)
      .then((data) => {
        if (cancelado) return;
        setEjercicios(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            handleApiError(err, "No se pudieron cargar los ejercicios de la máquina")
          );
        }
      });

    return () => {
      cancelado = true;
    };
  }, [maquinaId, intento]);

  const reintentar = () => {
    setEjercicios(null);
    setError(null);
    setIntento((actual) => actual + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {error !== null ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={reintentar}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-subtle"
          >
            Reintentar
          </button>
        </div>
      ) : ejercicios === null ? (
        <p className="text-sm text-ink-muted">Cargando ejercicios...</p>
      ) : ejercicios.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Esta máquina no tiene ejercicios asignados
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ejercicios.map((ejercicio) => (
            <li
              key={ejercicio.id}
              className="flex items-center gap-3 text-sm text-ink-soft"
            >
              <span className="font-medium">{ejercicio.nombre}</span>
              <span className="text-meta text-ink-muted">
                {ejercicio.grupoMuscular}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => onAsignar?.(maquinaId)}
          className="rounded bg-brand-strong px-4 py-2 text-sm font-medium text-surface hover:bg-brand-deep"
        >
          Asignar ejercicios
        </button>
      </div>
    </div>
  );
}
