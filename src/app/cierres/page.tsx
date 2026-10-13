"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import {
  fetchPreviewCierre,
  createCierre,
  type PreviewCierreResult,
} from "@/api/cierres";
import { handleApiError } from "@/utils/api-error";
import { SectionPageLayout } from "@/components/layout/section-page-layout";

/** Roles que pueden cerrar la caja (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/** Prisma serializa `Decimal` como string en JSON: aceptamos ambos. */
const money = (n: number | string) => `$${Number(n).toFixed(2)}`;

/**
 * Pantalla "Cierre de Caja" (T-040): muestra los totales del turno (previsualización
 * de los pagos pendientes) y confirma el cierre contra POST /api/cierres.
 */
export function CierresPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [totales, setTotales] = useState<PreviewCierreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
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

  const cargarPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTotales(await fetchPreviewCierre());
    } catch (err) {
      setError(handleApiError(err, "No se pudo calcular el cierre de caja."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    fetchPreviewCierre()
      .then((data) => {
        if (!cancelled) setTotales(data);
      })
      .catch((err) => {
        if (!cancelled) setError(handleApiError(err, "No se pudo calcular el cierre de caja."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  const handleConfirmar = async () => {
    setError(null);
    setConfirmando(true);
    try {
      // CC-2: cerrar exactamente el rango previsualizado, no un `new Date()` nuevo.
      const cierre = await createCierre(
        totales ? { desde: totales.desde, hasta: totales.hasta } : undefined
      );
      notify(
        "success",
        `Cierre registrado: ${money(cierre.totalRecaudado)} · ${cierre.cantidadOperaciones} operaciones`
      );
      await cargarPreview();
    } catch (err) {
      setError(handleApiError(err, "No se pudo cerrar la caja."));
    } finally {
      setConfirmando(false);
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
    <SectionPageLayout breadcrumb="Cierre de Caja">
      <h1 className="sr-only">Cierre de Caja</h1>

      <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border border-[#E4E4E7] bg-white p-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Total del turno</p>
          <p data-testid="cierre-total" className="text-3xl font-bold text-zinc-900">
            {totales ? money(totales.totalRecaudado) : "$0.00"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {totales?.cantidadOperaciones ?? 0} operaciones pendientes de cierre
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 text-sm text-zinc-600">
          <div className="flex justify-between">
            <span>Efectivo</span>
            <span>{money(totales?.totalEfectivo ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Transferencia</span>
            <span>{money(totales?.totalTransferencia ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tarjeta</span>
            <span>{money(totales?.totalTarjeta ?? 0)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmar}
          disabled={confirmando || loading}
          className="rounded bg-[#FC4C02] px-4 py-2 font-medium text-white hover:bg-[#C13D00] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {confirmando ? "Cerrando..." : "Confirmar cierre"}
        </button>
      </div>
    </SectionPageLayout>
  );
}

export default CierresPage;
