"use client";

import React, { useEffect, useState } from "react";
import { fetchSocioPorDni, type SocioBusqueda } from "@/api/socios";
import { fetchRutinas, type RutinaWithCount } from "@/api/rutinas";
import { createAsignacionRutina } from "@/api/rutinas-asignadas";
import { useNotifications } from "@/contexts/notifications";
import { handleApiError } from "@/utils/api-error";

const NIVEL_LABEL: Record<string, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

export interface AsignarRutinaModalProps {
  /** Cierra el modal sin asignar (botón X, "Cancelar") o después de asignar. */
  onClose: () => void;
  /** Se llama sólo cuando la asignación se guardó con éxito. */
  onAsignada?: () => void;
}

/**
 * Modal "Asignar Rutina a Socio" (T-034, openspec/asignar-rutina-flowspec.md):
 * busca el socio por DNI (reusa `/api/socios?dni=`), lista las rutinas
 * (`GET /api/rutinas`) y confirma contra `POST /api/rutinas-asignadas`.
 */
export function AsignarRutinaModal({ onClose, onAsignada }: AsignarRutinaModalProps) {
  const { notify } = useNotifications();

  const [dni, setDni] = useState("");
  const [socio, setSocio] = useState<SocioBusqueda | null>(null);
  const [rutinas, setRutinas] = useState<RutinaWithCount[]>([]);
  const [rutinaId, setRutinaId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cargandoRutinas, setCargandoRutinas] = useState(true);
  const [asignando, setAsignando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetchRutinas()
      .then((data) => {
        if (!cancelado) setRutinas(data);
      })
      .catch((err) => {
        if (!cancelado) setError(handleApiError(err, "No se pudieron cargar las rutinas."));
      })
      .finally(() => {
        if (!cancelado) setCargandoRutinas(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const handleBuscar = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSocio(null);
    setRutinaId("");

    const consulta = dni.trim();
    if (!consulta) {
      setError("Ingresá un DNI para buscar.");
      return;
    }

    setBuscando(true);
    try {
      setSocio(await fetchSocioPorDni(consulta));
    } catch (err) {
      setError(handleApiError(err, "No se pudo buscar el socio."));
    } finally {
      setBuscando(false);
    }
  };

  const handleAsignar = async () => {
    if (!socio || !rutinaId) return;

    setError(null);
    setAsignando(true);
    try {
      await createAsignacionRutina({ socioId: socio.id, rutinaId });
      notify("success", `Rutina asignada a ${socio.nombre}`);
      onAsignada?.();
      setDni("");
      setSocio(null);
      setRutinaId("");
      onClose();
    } catch (err) {
      setError(handleApiError(err, "No se pudo asignar la rutina."));
    } finally {
      setAsignando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Asignar Rutina a Socio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Asignar Rutina a Socio</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-xl leading-none">
            ×
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleBuscar} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="asignar-rutina-dni" className="mb-1 block text-sm font-medium text-gray-700">
              DNI
            </label>
            <input
              id="asignar-rutina-dni"
              name="dni"
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="XX.XXX.XXX o XXXXXXXX"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={buscando}
            className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {socio && (
          <section aria-label="Socio seleccionado" className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-zinc-900">{socio.nombre}</h3>
            <p className="text-sm text-gray-500">DNI {socio.dni}</p>
          </section>
        )}

        {socio && (
          <div>
            <label htmlFor="asignar-rutina-select" className="mb-1 block text-sm font-medium text-gray-700">
              Rutina
            </label>
            <select
              id="asignar-rutina-select"
              name="rutinaId"
              value={rutinaId}
              onChange={(e) => setRutinaId(e.target.value)}
              disabled={cargandoRutinas}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Seleccioná una rutina</option>
              {rutinas.map((r) => (
                <option key={r.id} value={r.id}>
                  {`${r.nombre} (Nivel: ${NIVEL_LABEL[r.nivelDeDificultad] ?? r.nivelDeDificultad}, ${r.duracionEstimada} min)`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAsignar}
            disabled={!socio || !rutinaId || asignando}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {asignando ? "Asignando..." : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}
