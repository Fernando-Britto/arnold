"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

/**
 * useModalA11y — shared keyboard/focus behavior for modal dialogs.
 *
 * Handles the three pieces every modal in this app needs:
 * - Escape closes the dialog;
 * - focus moves into the dialog on open and is trapped (Tab/Shift+Tab cycle
 *   within it, never escaping to the page behind);
 * - the element focused before opening (the trigger) gets focus back on close.
 *
 * The returned ref must be attached to the dialog's panel/container — the
 * element that owns the focusable controls.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Keep the latest onClose without re-running the effect below on every
  // render (consumers often pass inline closures). Refs must not be written
  // during render, so this is synced in an effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Initial focus: first focusable control (in these dialogs that is the
    // primary action, or the only control). Falls back to the container.
    const items = getFocusable(containerRef.current);
    if (items.length > 0) {
      items[0].focus();
    } else {
      containerRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = getFocusable(containerRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!containerRef.current?.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return containerRef;
}
