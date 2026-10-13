import React from "react";
import { AdminTopNav, type NavSection } from "./admin-top-nav";
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
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <AdminTopNav activeSection={activeSection} />
      <ActionBar breadcrumb={breadcrumb}>{actions}</ActionBar>

      {error && (
        <div role="alert" className="mx-12 mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <main className="flex grow flex-col gap-6 px-12 pb-12">{children}</main>
    </div>
  );
}
