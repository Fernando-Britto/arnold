"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { fetchHomeSocioData, type HomeSocioViewModel } from "@/api/home-socio";
import { TopNav, topNavHref } from "@/components/layout/top-nav";
import { ProgresoSection } from "@/components/home-socio/progreso-section";
import { AforoCard } from "@/components/home-socio/aforo-card";
import { TarjetaRutina } from "@/components/home-socio/tarjeta-rutina";
import { TarjetaDetalle } from "@/components/home-socio/tarjeta-detalle";
import { RachaSemanal } from "@/components/home-socio/racha-semanal";
import { MembresiaCard } from "@/components/home-socio/membresia-card";
import { EjecucionRutina } from "@/components/home-socio/ejecucion-rutina";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";

/**
 * A grid slot whose backing data/feature does not exist yet: renders the shared
 * "Trabajando en esto" panel instead of inventing content. The slot keeps its
 * `data-testid` so the row layout stays testable.
 */
function MissingCard({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} className="flex">
      <PlaceholderPanel className="w-full" />
    </div>
  );
}

/**
 * Home_Socio — T-019 Page Layout, rebuilt to match the real design
 * (Home_Socio_1x, OpenPencil export). Layout: TopNav, then Fila1
 * (Progreso + Aforo), Fila2 (Tarjeta_Rutina + Tarjeta_Detalle), Fila3
 * (Racha Semanal + Membresía).
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - Data comes from `GET /api/home-socio` (T-028); the page tests mock
 *   `fetchHomeSocioData` (see src/api/home-socio.ts).
 * - "Seguir rutina" opens EjecucionRutina (T-038, D-48), which starts or resumes the
 *   session against the sessions API and logs each serie with peso/reps/RIR.
 * - TopNav's non-Inicio links (Mi rutina/Mi membresía/Mi progreso) have no
 *   routes yet — see src/components/layout/top-nav.tsx.
 */
export function HomeSocioPage() {
  const router = useRouter();
  const { isAuthenticated, isMember, logout } = useAuth();

  const [data, setData] = useState<HomeSocioViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [indiceActual, setIndiceActual] = useState(0);
  const [modoEjecucion, setModoEjecucion] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isMember) {
      router.push("/home-interno");
    }
  }, [isAuthenticated, isMember, router]);

  useEffect(() => {
    if (!isAuthenticated || !isMember) return;

    let cancelled = false;

    fetchHomeSocioData()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setIndiceActual(result.rutinaActiva?.indiceActual ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No pudimos cargar tu inicio. Probá de nuevo en un momento.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isMember]);

  const handleSeguirRutina = useCallback(() => {
    setModoEjecucion(true);
  }, []);

  if (!isAuthenticated || !isMember) {
    return null;
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando tu inicio...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600">
        {error ?? "No pudimos cargar tu inicio. Probá de nuevo en un momento."}
      </div>
    );
  }

  if (modoEjecucion) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
        <TopNav active="inicio" onNavigate={(link) => router.push(topNavHref(link))} onLogoutClick={() => void logout()} />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-12">
          <EjecucionRutina
            rutinaAsignadaId={data.rutinaActiva?.rutinaAsignadaId ?? null}
            onCerrar={() => setModoEjecucion(false)}
          />
        </div>
      </div>
    );
  }

  const ejercicios = data.rutinaActiva?.ejercicios ?? [];
  const ejercicioActual = ejercicios[indiceActual] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <TopNav active="inicio" onNavigate={(link) => router.push(topNavHref(link))} onLogoutClick={() => void logout()} />

      {/* MainContent: padding 0/48/48/48, 24px gap (design-alignment.md). */}
      <main className="flex w-full flex-col gap-6 px-12 pb-12">
        {/* Fila1 — FilaProgreso (1157) + Aforo (633) */}
        <div data-testid="fila-1" className="grid gap-6 lg:grid-cols-[1157fr_633fr]">
          {data.progreso ? (
            <ProgresoSection
              ejercicioNombre={data.progreso.ejercicioNombre}
              marcaActual={data.progreso.marcaActual}
              deltaEsteMes={data.progreso.deltaEsteMes}
              progresionCarga={data.progreso.progresionCarga}
              proximaSesionSugerida={data.progreso.proximaSesionSugerida}
            />
          ) : (
            <MissingCard testId="card-progreso" />
          )}
          <AforoCard
            ocupacionActual={data.aforo.ocupacionActual}
            capacidadMaxima={data.aforo.capacidadMaxima}
            horas={data.aforo.horas}
            horaActual={data.aforo.horaActual}
          />
        </div>

        {/* Fila2 — Tarjeta_Rutina (1201) + Tarjeta_Detalle (589) */}
        <div data-testid="fila-2" className="grid gap-6 lg:grid-cols-[1201fr_589fr]">
          {data.rutinaActiva ? (
            <TarjetaRutina
              rutinaNombre={data.rutinaActiva.nombre}
              ejercicios={ejercicios}
              indiceActual={indiceActual}
              onSeguirRutina={handleSeguirRutina}
            />
          ) : (
            <MissingCard testId="card-rutina" />
          )}
          {ejercicioActual ? (
            <TarjetaDetalle
              ejercicio={{
                nombre: ejercicioActual.nombre,
                grupoMuscular: ejercicioActual.grupoMuscular,
                descripcion: ejercicioActual.descripcion,
              }}
              ejercicioEnRutina={{
                series: ejercicioActual.series,
                repeticiones: ejercicioActual.repeticiones,
                descanso: ejercicioActual.descanso,
              }}
            />
          ) : (
            <MissingCard testId="card-detalle" />
          )}
        </div>

        {/* Fila3 — RachaSemanal (895) + Membresia (895) */}
        <div data-testid="fila-3" className="grid gap-6 lg:grid-cols-2">
          <RachaSemanal semanasRacha={data.racha.semanasRacha} dias={data.racha.dias} />
          {data.membresia ? (
            <MembresiaCard
              planNombre={data.membresia.planNombre}
              fechaVencimiento={new Date(data.membresia.fechaVencimiento)}
              diasTotalMembresia={data.membresia.diasTotalMembresia}
              dias28={data.membresia.dias28}
              totalAsistencias={data.membresia.totalAsistencias28Dias}
            />
          ) : (
            <MissingCard testId="card-membresia" />
          )}
        </div>
      </main>
    </div>
  );
}

export default HomeSocioPage;
