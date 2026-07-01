import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { LayoutProvider, useLayout } from "@/context";
import { Sidebar } from "@/components/shared";

// Mobile-first dashboard shell.
//
//  - Phones (< sm_tablet): the catalog rail is an off-canvas drawer, opened by
//    the hamburger in a slim top bar and dimmed behind a backdrop.
//  - Tablet+ (sm_tablet): the rail is persistent and can collapse to an
//    icon-only mini rail. No top bar — the rail header carries the wordmark.
const DashboardShell = () => {
  const location = useLocation();
  const { isMobileOpen, openMobile, closeMobile } = useLayout();
  const isHome = location.pathname === "/";

  return (
    <div className="flex h-screen flex-col sm_tablet:flex-row">
      {/* Mobile top bar — hidden once the persistent rail takes over. */}
      <header className="flex items-center gap-3 border-b border-rule bg-surface/40 px-4 py-3 sm_tablet:hidden">
        <button
          type="button"
          onClick={openMobile}
          aria-label="Open navigation"
          aria-expanded={isMobileOpen}
          className="flex h-9 w-9 items-center justify-center border border-rule text-muted transition-colors hover:border-primary hover:text-ink"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <span className="font-display text-lg font-semibold leading-none text-ink">
          Athenæum
        </span>
      </header>

      {/* Backdrop for the mobile drawer. */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm sm_tablet:hidden"
          aria-hidden="true"
          onClick={closeMobile}
        />
      ) : null}

      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div
          className={`mx-auto flex min-h-full flex-col ${
            isHome ? "py-0" : "max-w-4xl px-4 py-6 sm_tablet:px-5 sm_tablet:py-8 sm_desktop:px-10"
          }`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const DashboardLayout = () => (
  <LayoutProvider>
    <DashboardShell />
  </LayoutProvider>
);

export default DashboardLayout;
