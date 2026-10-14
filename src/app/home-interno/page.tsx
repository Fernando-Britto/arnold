"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, UserX, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { fetchHomeInternoData, type HomeInternoData } from "@/api/home-interno";
import { guardarHomeInternoCache, leerHomeInternoCache } from "@/lib/home-interno-cache";
import { aggregateHomeInterno, GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";
import { AdminTopNav } from "@/components/layout/admin-top-nav";
import { QuickActions, type QuickAction } from "@/components/home-interno/quick-actions";
import { AlertasCard } from "@/components/home-interno/alertas-card";
import { AforoHoyCard } from "@/components/home-interno/aforo-hoy-card";
import { CajaCard } from "@/components/home-interno/caja-card";
import { OperationCard } from "@/components/home-interno/operation-card";
import { CounterCard } from "@/components/home-interno/counter-card";
import { ActivityColumn } from "@/components/home-interno/activity-column";
import { AsignarRutinaModal } from "@/components/rutina/asignar-rutina-modal";
import { ROLE_GATE_MATRIX } from "@/middleware/role-gating";

/**
 * Home_Interno — all five zones (Row_Acciones, Row_Hoy, Row_Operacion from
 * T-021a; Row_Gestion, Col_Actividad from T-021b), matching openspec/Home_Interno.svg.
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - "Nuevo Socio" goes to /clientes, "Registrar Pago" goes to /pagos and
 *   "Asignar Rutina" opens the modal (T-034, openspec/asignar-rutina-flowspec.md).
 *   "Control Acceso" opens /acceso, the DNI + PIN check-in kiosk (T-035).
 * - "Cierre de Caja" opens /cierres (T-040) for roles the matrix allows;
 *   for the rest it's rendered-but-disabled.
 * - Row_Operacion cards should open FILTERED lists (machines, staff,
 *   inactive socios); none exist. "Socios inactivos" goes to the unfiltered
 *   /clientes list; the other two are no-ops.
 * - Controls that lead to /clientes (Nuevo Socio, Alertas "Ver", Socios
 *   inactivos) and the Row_Gestion cards render for every staff role but are
 *   disabled when ROLE_GATE_MATRIX says the role cannot open the destination.
 * - AGGREGATION_TIMEOUT recovery: the last successful payload is cached in
 *   `sessionStorage` (src/lib/home-interno-cache.ts); a later failure shows it
 *   with a "datos desactualizados" banner + retry. With no cache, the spec's
 *   error message is shown.
 * - The design's "+12% vs ayer" under Caja has no spec/data source: omitted.
 * - Design shows 3 alert kinds (falta de pago / por vencer / inactividad);
 *   the spec only defines "Vencimiento", so only that is rendered.
 */
const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Admin",
  INSTRUCTOR: "Instructor",
  RECEPCIONISTA: "Recepción",
};

/** "Lunes, 24 de Junio de 2024", capitalised like the design. */
function formatFechaHeader(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: GYM_TIME_ZONE,
  })
    .format(fecha)
    .replace(/(^|\s)(\p{L}{3,})/gu, (_, sp, w: string) => sp + w[0].toUpperCase() + w.slice(1));
}

const GESTION_CARDS = [
  { key: "rutinas", label: "Rutinas", ruta: "/rutinas" },
  { key: "ejercicios", label: "Ejercicios", ruta: "/ejercicios" },
  { key: "clientes", label: "Clientes", ruta: "/clientes" },
  { key: "membresias", label: "Membresías", ruta: "/membresias" },
] as const;

const SectionLabel = ({ children }: { children: string }) => (
  <p className="text-[11px] font-bold tracking-wider text-zinc-500">{children}</p>
);

export function HomeInternoPage() {
  const router = useRouter();
  const { isAuthenticated, isMember, user } = useAuth();

  const [data, setData] = useState<HomeInternoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true cuando se están mostrando los últimos valores cacheados por un fallo posterior. */
  const [stale, setStale] = useState(false);
  /** Contador que dispara una recarga al reintentar. */
  const [intento, setIntento] = useState(0);
  const [asignarRutinaOpen, setAsignarRutinaOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (isMember) {
      router.push("/home-socio");
    }
  }, [isAuthenticated, isMember, router]);

  useEffect(() => {
    if (!isAuthenticated || isMember) return;

    let cancelled = false;

    fetchHomeInternoData()
      .then((result) => {
        if (cancelled) return;
        guardarHomeInternoCache(result);
        setData(result);
        setStale(false);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        // Degradación parcial (AGGREGATION_TIMEOUT): si hubo un payload exitoso previo,
        // se muestran sus últimos valores con aviso. Sin caché, se mantiene el error.
        const cache = leerHomeInternoCache();
        if (cache) {
          setData(cache);
          setStale(true);
          setError(null);
        } else {
          setData(null);
          setError("No se pudo cargar el resumen operativo");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isMember, intento]);

  const vm = useMemo(() => (data ? aggregateHomeInterno(data, data.ahora) : null), [data]);

  if (!isAuthenticated || isMember) return null;

  if (loading) return <div className="p-6 text-gray-500">Cargando el panel...</div>;

  if (error || !data || !vm) {
    return <div className="p-6 text-red-600">{error ?? "No se pudo cargar el resumen operativo"}</div>;
  }

  const puedeAbrir = (ruta: string) =>
    (ROLE_GATE_MATRIX[ruta] as string[] | undefined)?.includes(user?.rol ?? "") ?? false;

  /** Reintenta la carga del panel: muestra "Cargando" y dispara el efecto con `intento`. */
  const handleReintentar = () => {
    setLoading(true);
    setIntento((n) => n + 1);
  };

  const handleAction = (action: QuickAction) => {
    if (action === "nuevo-socio" && puedeAbrir("/clientes")) router.push("/clientes");
    else if (action === "registrar-pago" && puedeAbrir("/pagos")) router.push("/pagos");
    else if (action === "asignar-rutina" && puedeAbrir("/api/rutinas-asignadas"))
      setAsignarRutinaOpen(true);
    else if (action === "control-acceso" && puedeAbrir("/acceso")) router.push("/acceso");
  };

  // /clientes is the destination of Nuevo Socio, Alertas "Ver" and Socios inactivos.
  const sinClientes = !puedeAbrir("/clientes");

  // Quick actions the current role cannot use: rendered but disabled.
  const accionesDeshabilitadas: QuickAction[] = [];
  if (sinClientes) accionesDeshabilitadas.push("nuevo-socio");
  if (!puedeAbrir("/pagos")) accionesDeshabilitadas.push("registrar-pago");
  if (!puedeAbrir("/api/rutinas-asignadas")) accionesDeshabilitadas.push("asignar-rutina");
  if (!puedeAbrir("/acceso")) accionesDeshabilitadas.push("control-acceso");

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <AdminTopNav />
      <div className="border-t border-zinc-100 bg-white px-12 py-4 text-sm text-slate-600">
        {ROL_LABEL[user?.rol ?? ""] ?? "Staff"} · {formatFechaHeader(data.ahora)}
      </div>

      <main className="flex flex-col gap-6 p-12">
        {stale && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <span>Datos desactualizados: se muestran los últimos valores conocidos.</span>
            <button
              type="button"
              onClick={handleReintentar}
              className="rounded border border-amber-400 px-3 py-1 font-medium text-amber-900 enabled:hover:bg-amber-100"
            >
              Reintentar
            </button>
          </div>
        )}

        <QuickActions onAction={handleAction} disabledActions={accionesDeshabilitadas} />

        <SectionLabel>HOY</SectionLabel>
        <div className="grid gap-6 lg:grid-cols-[860fr_438fr_438fr]">
          <AlertasCard items={vm.alertas} onVer={() => router.push("/clientes")} verDisabled={sinClientes} />
          <AforoHoyCard {...vm.aforo} />
          <CajaCard
            {...vm.caja}
            onCierreDeCaja={() => router.push("/cierres")}
            cierreDisabled={!puedeAbrir("/cierres")}
          />
        </div>

        <SectionLabel>OPERACIÓN</SectionLabel>
        <div className="grid gap-6 lg:grid-cols-3">
          <OperationCard label="Estado de equipos" {...vm.equipos} icon={Dumbbell} />
          <OperationCard label="Personal en turno" {...vm.personal} icon={Users} />
          <OperationCard
            label="Socios inactivos"
            {...vm.inactivos}
            icon={UserX}
            disabled={sinClientes}
            onClick={() => router.push("/clientes")}
          />
        </div>

        <SectionLabel>GESTIÓN</SectionLabel>
        <div className="grid gap-6 lg:grid-cols-4">
          {GESTION_CARDS.map(({ key, label, ruta }) => (
            <CounterCard
              key={key}
              label={label}
              metric={vm.gestion[key]}
              disabled={!puedeAbrir(ruta)}
              onClick={() => router.push(ruta)}
            />
          ))}
        </div>

        <SectionLabel>ACTIVIDAD RECIENTE</SectionLabel>
        <ActivityColumn items={vm.actividad} />
      </main>

      {asignarRutinaOpen && <AsignarRutinaModal onClose={() => setAsignarRutinaOpen(false)} />}
    </div>
  );
}

export default HomeInternoPage;
