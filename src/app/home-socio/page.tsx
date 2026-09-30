"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { fetchHomeSocioData, type HomeSocioViewModel } from "@/api/home-socio";
import { TopNav } from "@/components/layout/top-nav";
import { ProgresoSection } from "@/components/home-socio/progreso-section";
import { AforoCard } from "@/components/home-socio/aforo-card";
import { TarjetaRutina } from "@/components/home-socio/tarjeta-rutina";
import { TarjetaDetalle } from "@/components/home-socio/tarjeta-detalle";
import { RachaSemanal } from "@/components/home-socio/racha-semanal";
import { MembresiaCard } from "@/components/home-socio/membresia-card";

/**
 * Home_Socio — T-019 Page Layout, rebuilt to match the real design
 * (Home_Socio_1x, OpenPencil export). Layout: TopNav, then Fila1
 * (Progreso + Aforo), Fila2 (Tarjeta_Rutina + Tarjeta_Detalle), Fila3
 * (Racha Semanal + Membresía).
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - `/api/home-socio` doesn't exist yet — built and tested against a
 *   mocked `fetchHomeSocioData` (see src/api/home-socio.ts).
 * - "Seguir rutina" only updates local UI state (starts the session, then
 *   advances the current exercise); there's no SesionDeEntrenamiento API to
 *   persist it against yet.
 * - TopNav's non-Inicio links (Mi rutina/Mi membresía/Mi progreso) have no
 *   routes yet — see src/components/layout/top-nav.tsx.
 */
export function HomeSocioPage() {
  const router = useRouter();
  const { isAuthenticated, isMember } = useAuth();

  const [data, setData] = useState<HomeSocioViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sesionEnProgreso, setSesionEnProgreso] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);

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
    setLoading(true);
    setError(null);

    fetchHomeSocioData()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setSesionEnProgreso(result.sesionEnProgreso);
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
    // TODO: POST/PATCH a SesionDeEntrenamiento once that API exists.
    setSesionEnProgreso(true);
    setIndiceActual((prev) => {
      const total = data?.rutinaActiva?.ejercicios.length ?? 1;
      return Math.min(prev + 1, total - 1);
    });
  }, [data]);

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

  const ejercicios = data.rutinaActiva?.ejercicios ?? [];
  const ejercicioActual = ejercicios[indiceActual] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <TopNav active="inicio" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-12">
        {/* Fila1 */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {data.progreso ? (
            <ProgresoSection
              ejercicioNombre={data.progreso.ejercicioNombre}
              marcaActual={data.progreso.marcaActual}
              deltaEsteMes={data.progreso.deltaEsteMes}
              progresionCarga={data.progreso.progresionCarga}
              proximaSesionSugerida={data.progreso.proximaSesionSugerida}
            />
          ) : (
            <ProgresoSection
              ejercicioNombre=""
              marcaActual={0}
              deltaEsteMes={0}
              progresionCarga={[]}
              proximaSesionSugerida={0}
            />
          )}
          <AforoCard
            ocupacionActual={data.aforo.ocupacionActual}
            capacidadMaxima={data.aforo.capacidadMaxima}
            horas={data.aforo.horas}
            horaActual={data.aforo.horaActual}
          />
        </div>

        {/* Fila2 */}
        <div className="flex gap-6">
          <TarjetaRutina
            rutinaNombre={data.rutinaActiva?.nombre ?? null}
            ejercicios={ejercicios}
            indiceActual={indiceActual}
            onSeguirRutina={handleSeguirRutina}
          />
          <TarjetaDetalle
            ejercicio={
              ejercicioActual
                ? {
                    nombre: ejercicioActual.nombre,
                    grupoMuscular: ejercicioActual.grupoMuscular,
                    descripcion: ejercicioActual.descripcion,
                  }
                : null
            }
            ejercicioEnRutina={
              ejercicioActual
                ? {
                    series: ejercicioActual.series,
                    repeticiones: ejercicioActual.repeticiones,
                    descanso: ejercicioActual.descanso,
                  }
                : null
            }
          />
        </div>

        {/* Fila3 */}
        <div className="flex gap-6">
          <RachaSemanal semanasRacha={data.racha.semanasRacha} dias={data.racha.dias} />
          {data.membresia && (
            <MembresiaCard
              planNombre={data.membresia.planNombre}
              fechaVencimiento={new Date(data.membresia.fechaVencimiento)}
              diasTotalMembresia={data.membresia.diasTotalMembresia}
              dias28={data.membresia.dias28}
              totalAsistencias={data.membresia.totalAsistencias28Dias}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default HomeSocioPage;
