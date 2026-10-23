"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, UserX, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { fetchHomeInternoData, type HomeInternoData } from "@/api/home-interno";
import { guardarHomeInternoCache, leerHomeInternoCache } from "@/lib/home-interno-cache";
import { aggregateHomeInterno, GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";
import { StaffRail } from "@/components/layout/staff-rail";
import { QuickActions, type QuickAction } from "@/components/home-interno/quick-actions";
import { AforoHoyCard } from "@/components/home-interno/aforo-hoy-card";
import { CajaCard } from "@/components/home-interno/caja-card";
import { OperationCard } from "@/components/home-interno/operation-card";
import { ActivityColumn } from "@/components/home-interno/activity-column";
import {
  PendientesDeHoy,
  type Pendiente,
} from "@/components/home-interno/pendientes-de-hoy";
import { AsignarRutinaModal } from "@/components/rutina/asignar-rutina-modal";
import { ROLE_GATE_MATRIX } from "@/middleware/role-gating";

/**
 * Panel operativo del staff.
 *
 * La pantalla responde al orden real del turno: plata → excepciones → ahora → operación → actividad.
 * El bloque dominante no es una tarjeta de datos más: es la caja del día. "Pendientes de hoy"
 * reemplaza a la lista pasiva de vencimientos: son excepciones que se resuelven con una acción.
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - Los atajos llevan a /clientes, /pagos, al modal de asignación y a /acceso; los que el rol no
 *   puede abrir se renderizan deshabilitados con el `title` que lo explica.
 * - Los contadores de "Gestión" (rutinas, ejercicios, clientes, membresías) se quitaron: son
 *   totales que ya están en el rail y no se accionan desde acá.
 * - "Equipos" y "Personal" salen de `Maquina` y `Empleado` reales; no son cifras inventadas.
 * - AGGREGATION_TIMEOUT: el último payload exitoso queda en `sessionStorage` y se muestra con
 *   aviso + reintentar.
 */
const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Admin",
  INSTRUCTOR: "Instructor",
  RECEPCIONISTA: "Recepción",
};

/** Suscripción vacía: el cache de la pestaña solo cambia con el fetch de esta pantalla. */
const suscribirAlCache = () => () => {};
/** En el servidor no hay sessionStorage: el snapshot inicial es "sin cache". */
const sinCache = () => null;

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

function haceCuanto(desde: Date, ahora: Date): string {
  const minutos = Math.max(0, Math.round((ahora.getTime() - desde.getTime()) / 60_000));
  if (minutos < 1) return "Actualizado hace instantes";
  if (minutos === 1) return "Actualizado hace 1 min";
  return `Actualizado hace ${minutos} min`;
}

export function HomeInternoPage() {
  const router = useRouter();
  const { isAuthenticated, isMember, user } = useAuth();

  const [data, setData] = useState<HomeInternoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true cuando se están mostrando los últimos valores cacheados por un fallo posterior. */
  const [stale, setStale] = useState(false);
  const [cargadoEn, setCargadoEn] = useState<Date | null>(null);
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

  // El cache de sessionStorage se lee fuera de un efecto, así el panel aparece al instante en
  // una recarga (F5) sin un setState dentro de useEffect. En el servidor no hay cache.
  const dataCache = useSyncExternalStore(suscribirAlCache, leerHomeInternoCache, sinCache);
  const dataActual = data ?? dataCache;

  useEffect(() => {
    if (!isAuthenticated || isMember) return;

    let cancelled = false;

    fetchHomeInternoData()
      .then((result) => {
        if (cancelled) return;
        guardarHomeInternoCache(result);
        setData(result);
        setCargadoEn(new Date());
        setStale(false);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
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

  const vm = useMemo(
    () => (dataActual ? aggregateHomeInterno(dataActual, dataActual.ahora) : null),
    [dataActual]
  );

  if (!isAuthenticated || isMember) return null;

  // Primera carga sin cache de la pestaña: un pulso, sin texto de "Cargando".
  if (!dataActual && loading) {
    return (
      <div
        className="theme-dark flex min-h-screen items-center justify-center bg-surface-page"
        role="status"
        aria-busy="true"
        aria-label="Cargando el panel"
      >
        <div className="h-2 w-32 animate-pulse rounded-full bg-surface-subtle" />
      </div>
    );
  }

  if (error || !dataActual || !vm) {
    return <div className="p-6 text-sm text-danger">{error ?? "No se pudo cargar el resumen operativo"}</div>;
  }

  const puedeAbrir = (ruta: string) =>
    (ROLE_GATE_MATRIX[ruta] as string[] | undefined)?.includes(user?.rol ?? "") ?? false;

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

  const sinClientes = !puedeAbrir("/clientes");

  const accionesDeshabilitadas: QuickAction[] = [];
  if (sinClientes) accionesDeshabilitadas.push("nuevo-socio");
  if (!puedeAbrir("/pagos")) accionesDeshabilitadas.push("registrar-pago");
  if (!puedeAbrir("/api/rutinas-asignadas")) accionesDeshabilitadas.push("asignar-rutina");
  if (!puedeAbrir("/acceso")) accionesDeshabilitadas.push("control-acceso");

  // Pendientes: excepciones que se resuelven hoy, la más urgente primero. El primer botón es la
  // única acción primaria de la pantalla; el resto son secundarias.
  const puedeCobrar = puedeAbrir("/pagos");
  const puedeAsignar = puedeAbrir("/api/rutinas-asignadas");
  const pendientes: Pendiente[] = [];

  for (const alerta of vm.alertas.slice(0, 2)) {
    pendientes.push({
      id: `cuota-${alerta.socioId}`,
      titulo: alerta.texto.replace("Vencimiento · ", ""),
      detalle: alerta.detalle,
      nivel: alerta.nivel === "vencida" ? "danger" : "warning",
      accion: "Cobrar",
      onAccion: () => router.push("/pagos"),
      disabled: !puedeCobrar,
    });
  }

  const anulacion = vm.actividad.find((item) => item.tipo === "ANULACION_PAGO");
  if (anulacion) {
    pendientes.push({
      id: "anulacion",
      titulo: `Pago anulado · ${anulacion.nombre}`,
      detalle: anulacion.haceTexto,
      nivel: "danger",
      accion: "Revisar",
      onAccion: () => router.push("/pagos"),
      disabled: !puedeCobrar,
    });
  }

  if (vm.sociosSinRutina > 0) {
    pendientes.push({
      id: "sin-rutina",
      titulo: `${vm.sociosSinRutina} ${vm.sociosSinRutina === 1 ? "socio activo" : "socios activos"} sin rutina`,
      detalle: "Requieren que un instructor les asigne una",
      nivel: "neutral",
      accion: "Asignar",
      onAccion: () => setAsignarRutinaOpen(true),
      disabled: !puedeAsignar,
    });
  }

  return (
    <div className="theme-dark flex min-h-screen flex-col bg-surface-page lg:flex-row">
      <StaffRail activeSection="inicio" />

      <main className="mx-auto flex w-full min-w-0 max-w-[1360px] flex-col gap-4 px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border-soft pb-3.5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Hoy</h1>
            <p className="text-sm text-ink-muted">
              {ROL_LABEL[user?.rol ?? ""] ?? "Staff"} · {formatFechaHeader(dataActual.ahora)}
            </p>
          </div>
          <p className="text-xs font-semibold text-ink-disabled">
            {haceCuanto(cargadoEn ?? dataActual.ahora, new Date())}
          </p>
        </header>

        {stale && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning"
          >
            <span>Datos desactualizados: se muestran los últimos valores conocidos.</span>
            <button
              type="button"
              onClick={handleReintentar}
              className="rounded border border-warning px-3 py-1 font-medium enabled:hover:bg-brand-soft"
            >
              Reintentar
            </button>
          </div>
        )}

        <QuickActions onAction={handleAction} disabledActions={accionesDeshabilitadas} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5">
            <CajaCard
              {...vm.caja}
              onCierreDeCaja={() => router.push("/cierres")}
              cierreDisabled={!puedeAbrir("/cierres")}
            />
          </div>

          <div className="min-w-0 lg:col-span-4">
            <PendientesDeHoy pendientes={pendientes} />
          </div>

          <div className="min-w-0 lg:col-span-3">
            <AforoHoyCard {...vm.aforo} />
          </div>

          <section
            aria-label="Operación"
            className="min-w-0 rounded-lg border border-border bg-surface lg:col-span-7"
          >
            <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-3">
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
          </section>

          <div className="min-w-0 lg:col-span-5">
            <ActivityColumn
              items={vm.actividad}
              onSelect={() => router.push(puedeCobrar ? "/pagos" : "/clientes")}
            />
          </div>
        </div>
      </main>

      {asignarRutinaOpen && <AsignarRutinaModal onClose={() => setAsignarRutinaOpen(false)} />}
    </div>
  );
}

export default HomeInternoPage;
