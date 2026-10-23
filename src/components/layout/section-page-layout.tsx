import React from "react";
import { StaffRail, type NavSection } from "./staff-rail";
import { ActionBar } from "./action-bar";

interface SectionPageLayoutProps {
  breadcrumb: string;
  /** Omitted on staff screens that aren't one of the CRUD sections (e.g. /pagos). */
  activeSection?: NavSection;
  actions?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}

/**
 * Shared chrome for staff screens that are not CRUD tables (/pagos, /cierres,
 * /acceso): the same TopNav + ActionBar + MainContent as the rest of the app.
 * MainContent keeps the spec's 48px horizontal/bottom padding and 24px gap.
 */
export function SectionPageLayout({
  breadcrumb,
  activeSection,
  actions,
  error,
  children,
}: SectionPageLayoutProps) {
  return (
    <div className="theme-dark flex min-h-screen flex-col bg-surface-page lg:flex-row">
      <StaffRail activeSection={activeSection} />

      <div className="flex min-w-0 flex-1 flex-col">
        <ActionBar breadcrumb={breadcrumb}>{actions}</ActionBar>

        {error && (
          <div role="alert" className="mx-6 mb-4 rounded-lg border border-danger-soft bg-danger-soft p-4 xl:mx-12">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <main className="flex grow flex-col gap-6 px-6 pb-8 xl:px-12 xl:pb-12">{children}</main>
      </div>
    </div>
  );
}
