import React from "react";
import { AdminTopNav, type NavSection } from "./admin-top-nav";
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
    <div className="flex min-h-screen flex-col bg-[#F7F7F8]">
      <AdminTopNav activeSection={section} />
      <ActionBar breadcrumb={breadcrumb}>{actions}</ActionBar>

      {error && (
        <div role="alert" className="mx-12 mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <main className="flex grow gap-6 px-12 pb-12">
        {formPanel}
        {listPanel}
      </main>
    </div>
  );
}

interface FormPanelShellProps {
  title: string;
  titleTestId?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

/** Panel izquierdo: tarjeta blanca con línea de acento naranja de la marca. */
export function FormPanelShell({ title, titleTestId, headerAction, children }: FormPanelShellProps) {
  return (
    <section className="flex h-fit w-96 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div data-testid="accent-line" className="w-[3px] shrink-0 bg-[#FC4C02]" />
      <div className="flex grow flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h2 data-testid={titleTestId} className="text-lg font-bold text-zinc-900">{title}</h2>
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
    <section className="grow overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.03)]">
      {children}
    </section>
  );
}
