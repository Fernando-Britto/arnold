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
import { AvisoOfertaReactivacion } from "@/components/home-socio/aviso-oferta";
import { EjecucionRutina } from "@/components/home-socio/ejecucion-rutina";

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
 * - TopNav's section links point to real routes via `topNavHref` (T-039). The
 *   page wires each card's action to its section route; TopNav's Buscar/Perfil
 *   have no destination yet and stay disabled (see top-nav.tsx).
 * - Empty data (no progreso/rutina/membresía) renders each component's own
 *   empty state — there is no "Trabajando en esto" placeholder left here.
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
        {/* Aviso de oferta de reactivación (D-54): solo se renderiza si el socio es elegible. */}
        <AvisoOfertaReactivacion descuentoPct={data.oferta?.descuentoPct ?? null} />

        {/* Fila1 — FilaProgreso (1157) + Aforo (633) */}
        <div data-testid="fila-1" className="grid gap-6 lg:grid-cols-[1157fr_633fr]">
          {/* Sin registros en la ventana → la sección muestra su propio estado vacío (no un placeholder). */}
          <ProgresoSection
            ejercicioNombre={data.progreso?.ejercicioNombre ?? ""}
            marcaActual={data.progreso?.marcaActual ?? 0}
            deltaEsteMes={data.progreso?.deltaEsteMes ?? 0}
            progresionCarga={data.progreso?.progresionCarga ?? []}
            proximaSesionSugerida={data.progreso?.proximaSesionSugerida ?? 0}
            onVerTodosLosEjercicios={() => router.push("/home-socio/mis-ejercicios")}
          />
          <AforoCard
            ocupacionActual={data.aforo.ocupacionActual}
            capacidadMaxima={data.aforo.capacidadMaxima}
            horas={data.aforo.horas}
            horaActual={data.aforo.horaActual}
          />
        </div>

        {/* Fila2 — Tarjeta_Rutina (1201) + Tarjeta_Detalle (589) */}
        <div data-testid="fila-2" className="grid gap-6 lg:grid-cols-[1201fr_589fr]">
          {/* Sin rutina asignada → ambas tarjetas muestran su propio estado vacío. */}
          <TarjetaRutina
            rutinaNombre={data.rutinaActiva?.nombre ?? null}
            ejercicios={ejercicios}
            indiceActual={indiceActual}
            sesionEnProgreso={data.sesionEnProgreso}
            onSeguirRutina={handleSeguirRutina}
          />
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
            <TarjetaDetalle ejercicio={null} ejercicioEnRutina={null} />
          )}
        </div>

        {/* Fila3 — RachaSemanal (895) + Membresia (895) */}
        <div data-testid="fila-3" className="grid gap-6 lg:grid-cols-2">
          <RachaSemanal
            semanasRacha={data.racha.semanasRacha}
            dias={data.racha.dias}
            onVerHistorial={() => router.push("/home-socio/mis-asistencias")}
          />
          {/* Sin membresía → la tarjeta muestra su propio estado vacío. */}
          <MembresiaCard
            planNombre={data.membresia?.planNombre ?? null}
            fechaVencimiento={
              data.membresia ? new Date(data.membresia.fechaVencimiento) : new Date(0)
            }
            diasTotalMembresia={data.membresia?.diasTotalMembresia ?? 0}
            dias28={data.membresia?.dias28 ?? []}
            totalAsistencias={data.membresia?.totalAsistencias28Dias ?? 0}
            onVerMembresia={() => router.push("/home-socio/mi-membresia")}
            onRenovar={() => router.push("/home-socio/mi-membresia")}
          />
        </div>
      </main>
    </div>
  );
}

export default HomeSocioPage;
