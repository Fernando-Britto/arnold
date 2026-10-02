"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, UserX, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { fetchHomeInternoPart1, type HomeInternoPart1Data } from "@/api/home-interno";
import { aggregateHomeInternoPart1, GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";
import { AdminTopNav } from "@/components/layout/admin-top-nav";
import { QuickActions, type QuickAction } from "@/components/home-interno/quick-actions";
import { AlertasCard } from "@/components/home-interno/alertas-card";
import { AforoHoyCard } from "@/components/home-interno/aforo-hoy-card";
import { CajaCard } from "@/components/home-interno/caja-card";
import { OperationCard } from "@/components/home-interno/operation-card";

/**
 * Home_Interno — T-021a Part 1 (Row_Acciones, Row_Hoy, Row_Operacion),
 * matching openspec/Home_Interno.svg. T-021b adds Row_Gestion + Col_Actividad.
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - `/api/home-interno` doesn't exist yet — see src/api/home-interno.ts.
 * - Only "Nuevo Socio" has a real destination (/clientes). "Registrar Pago",
 *   "Asignar Rutina" (modal, see openspec/asignar-rutina-flowspec.md) and
 *   "Control Acceso" have no screen/flow yet, so they're intentional no-ops.
 * - "Cierre de Caja" is a no-op: the CierreDeCaja flow isn't built.
 * - Row_Operacion cards should open FILTERED lists (machines, staff,
 *   inactive socios); none exist. "Socios inactivos" goes to the unfiltered
 *   /clientes list; the other two are no-ops.
 * - AGGREGATION_TIMEOUT recovery (cached last-known values + staleness
 *   indicator) isn't implemented; failures show the spec's error message.
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

const SectionLabel = ({ children }: { children: string }) => (
  <p className="text-[11px] font-bold tracking-wider text-zinc-500">{children}</p>
);

export function HomeInternoPage() {
  const router = useRouter();
  const { isAuthenticated, isMember, user } = useAuth();

  const [data, setData] = useState<HomeInternoPart1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    fetchHomeInternoPart1()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el resumen operativo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isMember]);

  const vm = useMemo(() => (data ? aggregateHomeInternoPart1(data, data.ahora) : null), [data]);

  if (!isAuthenticated || isMember) return null;

  if (loading) return <div className="p-6 text-gray-500">Cargando el panel...</div>;

  if (error || !data || !vm) {
    return <div className="p-6 text-red-600">{error ?? "No se pudo cargar el resumen operativo"}</div>;
  }

  const handleAction = (action: QuickAction) => {
    if (action === "nuevo-socio") router.push("/clientes");
    // registrar-pago / asignar-rutina / control-acceso: no destination yet (see header note).
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F1F3F5]">
      <AdminTopNav />
      <div className="border-t border-zinc-100 bg-white px-12 py-4 text-sm text-slate-600">
        {ROL_LABEL[user?.rol ?? ""] ?? "Staff"} · {formatFechaHeader(data.ahora)}
      </div>

      <main className="flex flex-col gap-6 p-12">
        <QuickActions onAction={handleAction} />

        <SectionLabel>HOY</SectionLabel>
        <div className="grid gap-6 lg:grid-cols-[860fr_438fr_438fr]">
          <AlertasCard items={vm.alertas} onVer={() => router.push("/clientes")} />
          <AforoHoyCard {...vm.aforo} />
          <CajaCard {...vm.caja} onCierreDeCaja={() => {}} />
        </div>

        <SectionLabel>OPERACIÓN</SectionLabel>
        <div className="grid gap-6 lg:grid-cols-3">
          <OperationCard label="Estado de equipos" {...vm.equipos} icon={Dumbbell} />
          <OperationCard label="Personal en turno" {...vm.personal} icon={Users} />
          <OperationCard
            label="Socios inactivos"
            {...vm.inactivos}
            icon={UserX}
            onClick={() => router.push("/clientes")}
          />
        </div>
      </main>
    </div>
  );
}

export default HomeInternoPage;
