"use client";

import React from "react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

export interface ConfirmDialogProps {
  /** Controla el montaje del diálogo. */
  open: boolean;
  title: string;
  message: string;
  /** Texto del botón principal (acción destructiva o de confirmación). */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Se llama al cancelar, con Escape o al cerrar. */
  onCancel: () => void;
  /** Pinta el botón de confirmar en rojo (acción destructiva). */
  danger?: boolean;
  /** Operación en curso: deshabilita ambos botones para evitar el doble envío. */
  confirmando?: boolean;
  /** Bloquea la confirmación (p. ej. el recurso está en uso). */
  confirmDisabled?: boolean;
}

/**
 * Diálogo de confirmación reutilizable (reemplaza `window.confirm`). Reusa `useModalA11y`
 * para Esc, focus-trap y foco de retorno. El foco inicial cae en Cancelar, la opción segura.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  confirmando = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(open, onCancel);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg">
        <h2 id="confirm-dialog-title" className="text-xl font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirmando}
            className="rounded-lg border border-border bg-surface px-5 py-2 font-semibold text-ink-soft hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando || confirmDisabled}
            className={`rounded-lg px-5 py-2 font-semibold text-surface disabled:cursor-not-allowed disabled:bg-ink-disabled ${
              danger ? "bg-danger hover:bg-danger-strong" : "bg-brand hover:bg-brand-strong"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
