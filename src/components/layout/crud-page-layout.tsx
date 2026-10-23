import React from "react";
import { StaffRail, type NavSection } from "./staff-rail";
import { ActionBar } from "./action-bar";

interface CrudPageLayoutProps {
  section: NavSection;
  breadcrumb: string;
  actions?: React.ReactNode;
  error?: string | null;
  formPanel: React.ReactNode;
  listPanel: React.ReactNode;
}

export function CrudPageLayout({
  section,
  breadcrumb,
  actions,
  error,
  formPanel,
  listPanel,
}: CrudPageLayoutProps) {
  return (
    <div className="theme-dark flex min-h-screen flex-col bg-surface-page lg:flex-row">
      <StaffRail activeSection={section} />

      {/* El rail es h-screen: si el contenido no va en una columna hermana, arranca debajo del
          pliegue y la pantalla parece vacía. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ActionBar breadcrumb={breadcrumb}>{actions}</ActionBar>

        {error && (
          <div role="alert" className="mx-6 mb-4 rounded-lg border border-danger-soft bg-danger-soft p-4 xl:mx-12">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <main className="flex grow flex-col gap-6 px-6 pb-8 xl:flex-row xl:px-12 xl:pb-12">
          {formPanel}
          {listPanel}
        </main>
      </div>
    </div>
  );
}

interface FormPanelShellProps {
  title: string;
  titleTestId?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Panel izquierdo del CRUD.
 *
 * Antes llevaba una banda naranja de 3px pegada al borde izquierdo. El piso de calidad
 * de diseño prohíbe un `border-left` de color mayor a 1px en cards y paneles: es el
 * recurso más gastado para fingir jerarquía, y acá competía con el botón primario.
 * El panel se distingue por su superficie, no por una barra de color.
 */
export function FormPanelShell({ title, titleTestId, headerAction, children }: FormPanelShellProps) {
  return (
    <section className="flex h-fit w-full shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface xl:w-[380px]">
      <div className="flex grow flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h2 data-testid={titleTestId} className="text-lg font-bold text-ink">{title}</h2>
          {headerAction}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Panel derecho: contenedor de la lista/tabla. */
export function ListPanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="grow overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {children}
    </section>
  );
}
