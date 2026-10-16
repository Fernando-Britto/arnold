"use client";

import React, { useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Panel de la pestaña activa (la página decide cuál montar). */
  children: React.ReactNode;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA): `role=tablist/tab/tabpanel`, activación
 * automática y navegación con flechas (Inicio/Fin incluidos).
 */
export function Tabs({ tabs, activeId, onChange, children }: TabsProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === activeId);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;

    event.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current.get(id)?.focus();
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones de configuración"
        onKeyDown={handleKeyDown}
        className="flex gap-6 border-b border-[#E4E4E7]"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) refs.current.set(tab.id, el);
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
                selected
                  ? "border-[#FC4C02] text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/** Contenedor del panel de una pestaña, enlazado con su `tab` por id. */
export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
