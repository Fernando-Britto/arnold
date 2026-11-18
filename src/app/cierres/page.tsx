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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResumenTurno } from "@/components/cierre/resumen-turno";
import { HistorialCierres } from "@/components/cierre/historial-cierres";
import { formatMoney as money } from "@/utils/formatting";

/** Roles que pueden cerrar la caja (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

/**
 * Pantalla "Cierre de Caja" (T-040): resumen del turno a ancho completo, confirmación
 * explícita antes de cerrar e historial paginado. El cierre usa el rango previsualizado
 * (CC-2), así lo que se confirma es exactamente lo que se mostró.
 */
export function CierresPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useNotifications();

  const [totales, setTotales] = useState<PreviewCierreResult | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [refrescarHistorial, setRefrescarHistorial] = useState(0);

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
    setCargando(true);
    setError(null);
    try {
      setTotales(await fetchPreviewCierre());
    } catch (err) {
      setError(handleApiError(err, "No se pudo calcular el cierre de caja."));
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial: el setState vive en los callbacks del fetch, no en el cuerpo del efecto.
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelado = false;
    fetchPreviewCierre()
      .then((data) => {
        if (!cancelado) setTotales(data);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(handleApiError(err, "No se pudo calcular el cierre de caja."));
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [isAuthorized]);

  /** Abre el diálogo. El POST ocurre recién al confirmar, nunca al abrir. */
  const abrirDialogo = () => {
    if (!totales) return;
    setError(null);
    setDialogoAbierto(true);
  };

  const cerrarDialogo = () => {
    if (!confirmando) setDialogoAbierto(false);
  };

  const handleConfirmar = async () => {
    if (!totales || confirmando) return;
    setConfirmando(true);
    try {
      // CC-2: cerrar exactamente el rango previsualizado, no un `new Date()` nuevo.
      const cierre = await createCierre({ desde: totales.desde, hasta: totales.hasta });
      notify(
        "success",
        `Cierre registrado: ${money(cierre.totalRecaudado)} · ${cierre.cantidadOperaciones} operaciones`
      );
      setDialogoAbierto(false);
      await cargarPreview();
      setRefrescarHistorial((n) => n + 1);
    } catch (err) {
      // El resumen queda intacto: el error se muestra en el panel para reintentar.
      setDialogoAbierto(false);
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
      <h1 className="text-2xl font-bold text-ink">Cierre de Caja</h1>

      <ResumenTurno
        totales={totales}
        cargando={cargando}
        error={error}
        confirmando={confirmando}
        onConfirmar={abrirDialogo}
        onReintentar={cargarPreview}
      />

      <HistorialCierres key={refrescarHistorial} refrescarToken={refrescarHistorial} />

      <ConfirmDialog
        open={dialogoAbierto}
        title="Confirmar cierre de caja"
        message="Revisá el resumen antes de cerrar el turno."
        confirmLabel={confirmando ? "Cerrando…" : "Confirmar cierre"}
        onCancel={cerrarDialogo}
        onConfirm={handleConfirmar}
        confirmando={confirmando}
      >
        {totales && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-muted">Total recaudado</p>
            <p className="text-2xl font-bold text-ink">{money(totales.totalRecaudado)}</p>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between">
                <dt>Efectivo</dt>
                <dd className="tabular-nums">{money(totales.totalEfectivo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Transferencia</dt>
                <dd className="tabular-nums">{money(totales.totalTransferencia)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tarjeta</dt>
                <dd className="tabular-nums">{money(totales.totalTarjeta)}</dd>
              </div>
            </dl>
            <p>{totales.cantidadOperaciones} operaciones incluidas</p>
          </div>
        )}
      </ConfirmDialog>
    </SectionPageLayout>
  );
}

export default CierresPage;
