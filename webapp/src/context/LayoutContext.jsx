/* eslint-disable react-refresh/only-export-components -- provider + its hook are intentionally colocated */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks";

// Genuinely global layout state for the dashboard shell. Two independent axes:
//
//  - isMobileOpen  — the off-canvas drawer on phones (< sm_tablet). Transient,
//    never persisted; defaults closed and auto-closes on route change.
//  - isRailCollapsed — the icon-only "mini rail" on tablet+ . A deliberate user
//    preference, so it persists across reloads via localStorage.
//
// The matching breakpoint is sm_tablet (600px) so the boundary stays in sync
// with the Tailwind `sm_tablet:` utilities used in the shell.
const LayoutContext = createContext(null);

const RAIL_STORAGE_KEY = "athenaeum:sidebar-collapsed";

const readStoredCollapsed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const LayoutProvider = ({ children }) => {
  // Tailwind sm_tablet breakpoint = 600px. "Mobile" is anything narrower.
  const isMobile = useMediaQuery("(max-width: 599px)");

  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isRailCollapsed, setRailCollapsed] = useState(readStoredCollapsed);

  // Persist the desktop rail preference.
  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, String(isRailCollapsed));
    } catch {
      /* storage unavailable (private mode); preference is best-effort */
    }
  }, [isRailCollapsed]);

  // Crossing into desktop should never leave a half-open mobile drawer behind.
  // This synchronizes transient UI state to the viewport (an external signal),
  // so the synchronous set is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleRail = useCallback(() => setRailCollapsed((prev) => !prev), []);

  const value = useMemo(
    () => ({
      isMobile,
      isMobileOpen,
      openMobile,
      closeMobile,
      isRailCollapsed,
      toggleRail,
    }),
    [isMobile, isMobileOpen, openMobile, closeMobile, isRailCollapsed, toggleRail],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export const useLayout = () => {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return ctx;
};
