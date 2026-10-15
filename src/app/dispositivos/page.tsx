"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import {
  cambiarEstadoDispositivo,
  crearDispositivo,
  fetchDispositivos,
  type DispositivoDTO,
  type TipoDispositivo,
} from "@/api/dispositivos";
import { handleApiError } from "@/utils/api-error";
import { SectionPageLayout } from "@/components/layout/section-page-layout";
import { DispositivoListPanel } from "@/components/dispositivos/dispositivo-list";

/** Solo el Administrador gestiona dispositivos (D-43 propuesta 4 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

const TIPOS: ReadonlyArray<{ value: TipoDispositivo; label: string }> = [
  { value: "PUERTA", label: "Puerta" },
  { value: "RECEPCION", label: "Recepción" },
];

/**
 * Pantalla "Dispositivos" (AC-11): lista los dispositivos (nombre, estado, último contacto),
 * permite provisionar uno nuevo mostrando su token UNA sola vez, y desactivar uno existente.
 */
export function DispositivosPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [dispositivos, setDispositivos] = useState<DispositivoDTO[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoDispositivo>("PUERTA");
  const [tokenCreado, setTokenCreado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [desactivandoId, setDesactivandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = Boolean(isAuthenticated && user && ALLOWED_ROLES.includes(user.rol));

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !ALLOWED_ROLES.includes(user.rol)) {
      router.push("/home-socio");
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthorized) return;
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
  }, [isAuthorized]);

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

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Acceso Denegado</h1>
          <p className="text-gray-600">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <SectionPageLayout breadcrumb="Dispositivos" activeSection="dispositivos" error={error}>
      <h1 className="sr-only">Dispositivos</h1>

      <section className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-[#E4E4E7] bg-white p-6">
        <h2 className="text-sm font-bold text-zinc-900">Nuevo dispositivo</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            id="nombre"
            data-testid="dispositivo-nombre"
            type="text"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej: Puerta principal"
            className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tipo" className="text-sm font-medium text-gray-700">
            Tipo
          </label>
          <select
            id="tipo"
            data-testid="dispositivo-tipo"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as TipoDispositivo)}
            className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm"
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
          className="self-start rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {creando ? "Creando..." : "Crear dispositivo"}
        </button>

        {tokenCreado && (
          <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">
              Guardá este token ahora: no se volverá a mostrar.
            </p>
            <code
              data-testid="dispositivo-token"
              className="mt-2 block break-all rounded bg-white px-2 py-1 text-sm"
            >
              {tokenCreado}
            </code>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#E4E4E7] bg-white">
        {loading ? (
          <p className="p-6 text-gray-500">Cargando dispositivos...</p>
        ) : (
          <DispositivoListPanel
            dispositivos={dispositivos}
            onDesactivar={(d) => void handleDesactivar(d)}
            desactivandoId={desactivandoId}
          />
        )}
      </section>
    </SectionPageLayout>
  );
}

export default DispositivosPage;
