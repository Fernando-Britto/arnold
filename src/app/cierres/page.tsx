"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import {
  fetchPreviewCierre,
  createCierre,
  fetchCierres,
  type PreviewCierreResult,
  type CierreDeCajaResumenDTO,
} from "@/api/cierres";
import { handleApiError } from "@/utils/api-error";
import { SectionPageLayout } from "@/components/layout/section-page-layout";
import { formatMoney as money } from "@/utils/formatting";
import { GYM_TIME_ZONE } from "@/domains/home-interno/home-interno";

/** Roles que pueden cerrar la caja (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/** Fecha del cierre en hora del gimnasio: "11/10/2026". */
function formatFechaCierre(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: GYM_TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * Pantalla "Cierre de Caja" (T-040): muestra los totales del turno (previsualización
 * de los pagos pendientes) y confirma el cierre contra POST /api/cierres.
 */
export function CierresPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [totales, setTotales] = useState<PreviewCierreResult | null>(null);
  const [cierres, setCierres] = useState<CierreDeCajaResumenDTO[]>([]);
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

  /**
   * Historial de cierres (CC-3). Es información secundaria: si falla, el flujo de
   * previsualizar/cerrar sigue funcionando y sólo se deja el historial vacío.
   */
  const cargarHistorial = useCallback(async () => {
    try {
      setCierres(await fetchCierres());
    } catch {
      setCierres([]);
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

    // Historial (CC-3): carga secundaria dentro del mismo efecto, sin setState síncrono.
    fetchCierres()
      .then((data) => {
        if (!cancelled) setCierres(data);
      })
      .catch(() => {
        if (!cancelled) setCierres([]);
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
      await cargarHistorial();
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
          <p className="text-ink-muted">No tenés permiso para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <SectionPageLayout activeSection="cierres" breadcrumb="Cierre de Caja">
      <h1 className="sr-only">Cierre de Caja</h1>

      <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border border-border bg-surface p-6">
        <div>
          <p className="text-sm font-medium text-ink-muted">Total del turno</p>
          <p data-testid="cierre-total" className="text-3xl font-bold text-ink">
            {totales ? money(totales.totalRecaudado) : "$0.00"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {totales?.cantidadOperaciones ?? 0} operaciones pendientes de cierre
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-danger-soft bg-danger-soft p-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
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
          className="rounded bg-brand-strong px-4 py-2 font-medium text-surface hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-disabled"
        >
          {confirmando ? "Cerrando..." : "Confirmar cierre"}
        </button>
      </div>

      <section aria-labelledby="cierres-recientes" className="mt-6 flex w-full max-w-lg flex-col gap-3">
        <h2 id="cierres-recientes" className="text-sm font-medium text-ink-muted">
          Cierres recientes
        </h2>
        {cierres.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin cierres registrados.</p>
        ) : (
          <ul data-testid="historial-cierres" className="flex flex-col gap-3">
            {cierres.map((cierre) => (
              <li
                key={cierre.id}
                className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-muted"
              >
                <div className="flex justify-between font-medium text-ink">
                  <span>{formatFechaCierre(cierre.createdAt)}</span>
                  <span data-testid={`cierre-total-${cierre.id}`}>{money(cierre.totalRecaudado)}</span>
                </div>
                <div className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
                  <div className="flex justify-between">
                    <span>Efectivo</span>
                    <span>{money(cierre.totalEfectivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transferencia</span>
                    <span>{money(cierre.totalTransferencia)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarjeta</span>
                    <span>{money(cierre.totalTarjeta)}</span>
                  </div>
                  <span className="pt-1">{cierre.cantidadOperaciones} operaciones</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SectionPageLayout>
  );
}

export default CierresPage;
