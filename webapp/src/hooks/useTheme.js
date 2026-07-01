import { useCallback, useEffect, useState } from "react";

// Theme contract for the archive palette. `mode` is what the user chose
// (system / light / dark); `theme` is the resolved palette actually applied to
// <html data-theme>. "system" means "no override — follow the OS", so it
// resolves to light/dark at read time and re-resolves when the OS flips.
const MODES = { SYSTEM: "system", DARK: "dark", LIGHT: "light" };
const STORAGE_KEY = "athenaeum-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const isMode = (v) => v === MODES.SYSTEM || v === MODES.DARK || v === MODES.LIGHT;

// Read the user's saved mode. A missing/invalid value means "system" (follow the
// OS) — the same default the pre-paint script in index.html assumes. Older
// builds stored only "dark"/"light"; those are still valid modes here.
const readStoredMode = () => {
  if (typeof window === "undefined") return MODES.SYSTEM;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isMode(saved) ? saved : MODES.SYSTEM;
  } catch {
    return MODES.SYSTEM;
  }
};

const systemTheme = () =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches
    ? MODES.DARK
    : MODES.LIGHT;

// Single source of truth for the active theme. Holds the chosen mode, reflects
// the resolved palette onto <html data-theme>, persists the mode, and (in system
// mode) follows OS changes live. The pre-paint inline script in index.html
// applies the same resolution before React mounts so there's no flash.
export const useTheme = () => {
  const [mode, setMode] = useState(readStoredMode);

  // The OS preference, tracked as the one piece of external state. `theme` is
  // derived from (mode, osDark) during render rather than mirrored into its own
  // state — so there's no setState-in-effect cascade, and a system-mode OS flip
  // re-renders simply by updating this flag.
  const [osDark, setOsDark] = useState(
    () => systemTheme() === MODES.DARK,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (event) => setOsDark(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Resolved palette: "system" follows the OS flag, light/dark pin it.
  const theme =
    mode === MODES.SYSTEM ? (osDark ? MODES.DARK : MODES.LIGHT) : mode;

  // Reflect the resolved theme onto the root element so the CSS token sets apply.
  // Pure external-system sync (no setState) — the lint-safe shape for effects.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Set an explicit mode and persist it, so the choice survives refreshes. Used
  // by the Appearance settings three-way toggle (System / Light / Dark).
  const setThemeMode = useCallback((next) => {
    if (!isMode(next)) return;
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; ignore storage failures (privacy mode).
    }
  }, []);

  // Flip light<->dark. Kept for the account-menu quick toggle. Resolves the
  // current effective theme first so toggling out of "system" does the obvious
  // thing (go to the opposite of what's on screen).
  const toggleTheme = useCallback(() => {
    setThemeMode(theme === MODES.DARK ? MODES.LIGHT : MODES.DARK);
  }, [theme, setThemeMode]);

  return { theme, mode, setThemeMode, toggleTheme };
};
