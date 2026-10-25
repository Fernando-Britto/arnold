"use client";

import { useEffect, useId, useState } from "react";
import { fetchEjerciciosBusqueda } from "@/api/ejercicios";
import { fetchMaquinaEjercicios, reemplazarEjerciciosMaquina } from "@/api/maquinas";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { useNotifications } from "@/contexts/notifications";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { handleApiError } from "@/utils/api-error";

const LIMITE = 50;
const DEBOUNCE_MS = 300;

export interface EjercicioAsignacionModalProps {
  open: boolean;
  maquinaId: string;
  onClose: () => void;
  onSaved?: () => void;
}

// Sin total en el catálogo: "Ver más" sólo con página completa. La selección
// vive fuera de la página visible y el guardado manda el reemplazo total.
export function EjercicioAsignacionModal({ open, maquinaId, onClose, onSaved }: EjercicioAsignacionModalProps) {
  const { notify } = useNotifications();
  const tituloId = useId();
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  const [busqueda, setBusqueda] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [ejercicios, setEjercicios] = useState<EjercicioConUso[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [sembrando, setSembrando] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Siembra la selección con lo ya asociado, incluidas las filas fuera de la página.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la siembra debe bloquear el guardado antes de que resuelva la promesa; derivarla exigiría duplicar el estado de la consulta.
    setSembrando(true);

    fetchMaquinaEjercicios(maquinaId)
      .then((asignados) => {
        if (!cancelado) setSeleccion(new Set(asignados.map((e) => e.id)));
      })
      .catch((err) => {
        if (!cancelado) {
          setError(handleApiError(err, "No se pudieron cargar los ejercicios asignados"));
        }
      })
      .finally(() => {
        if (!cancelado) setSembrando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, maquinaId]);

  // Debounce: una sola consulta ~300 ms después de la última tecla.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setAplicada(busqueda), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, busqueda]);

  // Primera página de cada búsqueda: reemplaza la lista.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la bandera de carga debe estar activa antes de que resuelva la promesa; derivarla exigiría duplicar el estado de la consulta.
    setCargandoLista(true);

    fetchEjerciciosBusqueda({ search: aplicada, limit: LIMITE, offset: 0 })
      .then((data) => {
        if (cancelado) return;
        setEjercicios(data);
        setHayMas(data.length === LIMITE);
      })
      .catch((err) => {
        if (!cancelado) setError(handleApiError(err, "No se pudieron buscar los ejercicios"));
      })
      .finally(() => {
        if (!cancelado) setCargandoLista(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, maquinaId, aplicada]);

  if (!open) return null;

  const alternar = (id: string) =>
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const todosVisibles = ejercicios.length > 0 && ejercicios.every((e) => seleccion.has(e.id));

  const alternarVisibles = () => {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      for (const ejercicio of ejercicios) {
        if (todosVisibles) siguiente.delete(ejercicio.id);
        else siguiente.add(ejercicio.id);
      }
      return siguiente;
    });
  };

  const verMas = async () => {
    setCargandoLista(true);
    try {
      const data = await fetchEjerciciosBusqueda({ search: aplicada, limit: LIMITE, offset: ejercicios.length });
      setEjercicios((prev) => [...prev, ...data]);
      setHayMas(data.length === LIMITE);
    } catch (err) {
      setError(handleApiError(err, "No se pudieron buscar los ejercicios"));
    } finally {
      setCargandoLista(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await reemplazarEjerciciosMaquina(maquinaId, Array.from(seleccion));
      notify("success", "Ejercicios asignados");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(handleApiError(err, "No se pudieron guardar los ejercicios de la máquina"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 rounded-2xl bg-surface p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 id={tituloId} className="text-lg font-semibold text-ink">Asignar ejercicios</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-xl leading-none text-ink-muted">
            ×
          </button>
        </div>

        {error && <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">{error}</p>}

        <label htmlFor="buscar-ejercicios" className="block text-sm font-medium text-ink-soft">
          Buscar ejercicios
        </label>
        <input
          id="buscar-ejercicios"
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-soft"
        />

        {sembrando ? (
          <p className="text-sm text-ink-muted">Cargando ejercicios asignados...</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={alternarVisibles}
              disabled={ejercicios.length === 0}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink-soft disabled:text-ink-disabled"
            >
              Seleccionar todo visible
            </button>
            <span className="text-sm text-ink-muted">
              {`${seleccion.size} seleccionado${seleccion.size === 1 ? "" : "s"}`}
            </span>
          </div>
        )}

        <div className="min-h-40 flex-1 overflow-y-auto">
          {cargandoLista ? (
            <p className="py-4 text-center text-sm text-ink-muted">Cargando ejercicios...</p>
          ) : ejercicios.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">No hay ejercicios</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {ejercicios.map((ejercicio) => (
                <li key={ejercicio.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm text-ink-soft">
                    <input type="checkbox" aria-label={ejercicio.nombre} checked={seleccion.has(ejercicio.id)} onChange={() => alternar(ejercicio.id)} />
                    <span className="font-medium">{ejercicio.nombre}</span>
                    <span className="text-meta text-ink-muted">{ejercicio.grupoMuscular}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {hayMas && !cargandoLista && (
            <button type="button" onClick={verMas} className="mt-2 w-full rounded border border-border px-3 py-2 text-sm font-medium text-ink-soft">
              Ver más
            </button>
          )}
        </div>

        <button type="button" onClick={guardar} disabled={guardando || sembrando} className="self-end rounded bg-brand-strong px-4 py-2 text-sm font-medium text-surface disabled:bg-ink-disabled">
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
