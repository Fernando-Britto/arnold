"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import {
  fetchHomeSocioSeccionesData,
  type HomeSocioSeccionesViewModel,
} from "@/api/home-socio-secciones";

export interface UseSeccionesSocio {
  data: HomeSocioSeccionesViewModel | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isMember: boolean;
}

/**
 * Hook de las secciones del socio: redirige según la sesión (login / home-interno) y carga
 * `GET /api/home-socio/secciones`. La identidad la resuelve el servidor desde la cookie; acá
 * no se manda ningún `socioId`.
 */
export function useSeccionesSocio(): UseSeccionesSocio {
  const router = useRouter();
  const { isAuthenticated, isMember } = useAuth();

  const [data, setData] = useState<HomeSocioSeccionesViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchHomeSocioSeccionesData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError("No pudimos cargar tus datos. Probá de nuevo en un momento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isMember]);

  return { data, loading, error, isAuthenticated, isMember };
}
