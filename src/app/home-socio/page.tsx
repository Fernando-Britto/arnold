"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { fetchHomeSocioData, type HomeSocioViewModel } from "@/api/home-socio";
import { SocioShell } from "@/components/home-socio/socio-shell";
import { AvisoOfertaReactivacion } from "@/components/home-socio/aviso-oferta";
import { EjecucionRutina } from "@/components/home-socio/ejecucion-rutina";
import { SesionHero } from "@/components/home-socio/sesion-hero";
import { ProgresoCargaCard } from "@/components/home-socio/progreso-carga-card";
import { TuSerieCard } from "@/components/home-socio/tu-serie-card";
import { UltimasSesiones } from "@/components/home-socio/ultimas-sesiones";
import { PesoCorporalCard } from "@/components/home-socio/peso-corporal-card";
import { SeccionCargando } from "@/components/home-socio/seccion-cargando";
import { SugerenciaAsignacion } from "@/components/home-socio/sugerencia-asignacion";
import { CLAVES, invalidarCache, leerCache } from "@/lib/cache-cliente";
import { diasHastaVencimiento } from "@/domains/home-socio/home-socio";

/**
 * Home del socio.
 *
 * Reemplaza las cuatro filas de tarjetas iguales por una pantalla con un solo eje: la sesión de
 * hoy manda (recorrido + una acción), el historial y los números acompañan. El sustrato oscuro y
 * el rail vienen de `SocioShell`.
 *
 * SCOPE BOUNDARY (documented, not hidden):
 * - "Empezar entrenamiento" abre `EjecucionRutina` (T-038), que inicia o retoma la sesión contra
 *   la API de sesiones y registra cada serie.
 * - La media del hero es la del ejercicio actual en el catálogo (`public/ejercicios`); si el
 *   ejercicio no tiene media cargada, el hero se muestra sin imagen.
 * - "Últimas sesiones" usa volumen y duración calculados en el servidor a partir de los registros
 *   de progreso y `horaFin − horaInicio`. No se inventa ningún dato que la API no devuelva.
 * - `PesoCorporalCard` se mantiene tal cual: además de mostrar, registra y borra pesajes.
 */
const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function HomeSocioPage() {
  const router = useRouter();
  const { isAuthenticated, isMember, logout } = useAuth();

  const [data, setData] = useState<HomeSocioViewModel | null>(() =>
    leerCache<HomeSocioViewModel>(CLAVES.homeSocio)
  );
  const [loading, setLoading] = useState(() => data === null);
  const [error, setError] = useState<string | null>(null);
  const [modoEjecucion, setModoEjecucion] = useState(false);
  // `ahora` se congela al montar: el reloj es impuro y no debe leerse en el render.
  const [ahora] = useState(() => new Date());

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isMember) {
      router.push("/home-interno");
    }
  }, [isAuthenticated, isMember, router]);

  const cargarHome = useCallback((esCargaInicial = false) => {
    let cancelled = false;

    fetchHomeSocioData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        // Una recarga fallida no borra lo que ya se ve; solo la carga inicial muestra el error.
        if (!cancelled && esCargaInicial) {
          setError("No pudimos cargar tu inicio. Probá de nuevo en un momento.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isMember) return;
    return cargarHome(true);
  }, [isAuthenticated, isMember, cargarHome]);

  const handleSeguirRutina = useCallback(() => setModoEjecucion(true), []);

  const cerrarEjecucion = useCallback(() => {
    setModoEjecucion(false);
    // D-121: el payload del home está cacheado 60 s; se invalida para que `sesionEnProgreso` no quede
    // viejo y la tarjeta no siga oculta después de entrenar.
    invalidarCache(CLAVES.homeSocio);
    cargarHome();
  }, [cargarHome]);

  if (!isAuthenticated || !isMember) return null;

  return (
    <SocioShell active="inicio">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border-soft pb-3.5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Hoy</h1>
          <p className="text-sm text-ink-muted">{fmtFecha.format(new Date())}</p>
        </div>
        {data?.membresia && (
          <p className="text-sm font-semibold text-ink-muted">
            {data.membresia.planNombre} ·{" "}
            <span className="text-ink">
              {diasHastaVencimiento(new Date(data.membresia.fechaVencimiento), ahora)} días
            </span>
          </p>
        )}
      </header>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : modoEjecucion ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <EjecucionRutina
            rutinaAsignadaId={data?.rutinaActiva?.rutinaAsignadaId ?? null}
            onCerrar={cerrarEjecucion}
          />
        </div>
      ) : loading && !data ? (
        <SeccionCargando className="h-72" />
      ) : data ? (
        <>
          <AvisoOfertaReactivacion descuentoPct={data.oferta?.descuentoPct ?? null} />

          {/* D-118: con una sesión en curso la reserva es la del siguiente ejercicio y no se consume
              a mitad de sesión, así que no se ofrece. */}
          {data.rutinaActiva && !data.sesionEnProgreso && (
            <SugerenciaAsignacion onSeguirRutina={handleSeguirRutina} />
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_352px]">
            <div className="flex min-w-0 flex-col gap-5">
              <SesionHero
                rutinaNombre={data.rutinaActiva?.nombre ?? null}
                ejercicios={data.rutinaActiva?.ejercicios ?? []}
                indiceActual={data.rutinaActiva?.indiceActual ?? 0}
                sesionEnProgreso={data.sesionEnProgreso}
                onSeguirRutina={handleSeguirRutina}
              />
              <UltimasSesiones
                sesiones={data.ultimasSesiones}
                asistencias28={data.membresia?.totalAsistencias28Dias ?? null}
              />
            </div>

            <aside className="flex min-w-0 flex-col gap-5">
              <ProgresoCargaCard
                ejercicioNombre={data.progreso?.ejercicioNombre ?? ""}
                marcaActual={data.progreso?.marcaActual ?? 0}
                deltaEsteMes={data.progreso?.deltaEsteMes ?? 0}
                progresionCarga={data.progreso?.progresionCarga ?? []}
              />
              <TuSerieCard
                semanasRacha={data.racha.semanasRacha}
                dias={data.racha.dias}
                dias28={data.membresia?.dias28 ?? []}
              />
              <PesoCorporalCard
                mediciones={data.peso.mediciones}
                pesoObjetivo={data.peso.pesoObjetivo}
                pesoInicial={data.peso.pesoInicial}
              />
            </aside>
          </div>
        </>
      ) : null}
    </SocioShell>
  );
}

export default HomeSocioPage;
