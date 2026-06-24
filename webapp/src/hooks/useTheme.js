import { useCallback, useEffect, useState } from "react";

// Theme contract for the archive palette. Both values map 1:1 to the
// [data-theme] token sets defined in index.css.
const THEMES = { DARK: "dark", LIGHT: "light" };
const STORAGE_KEY = "athenaeum-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const isTheme = (value) => value === THEMES.DARK || value === THEMES.LIGHT;

// Read the user's saved manual choice. Returns null when nothing is stored (or
// when storage is unavailable, e.g. SSR / privacy mode) so we can fall back to
// the system preference.
const readStored = () => {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
};

const systemTheme = () =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches
    ? THEMES.DARK
    : THEMES.LIGHT;

// Resolve the theme to use on first paint: saved choice wins, otherwise the OS
// preference. The pre-paint inline script in index.html applies the same logic
// to <html> so there's no flash; this just keeps React state in sync.
const initialTheme = () => readStored() ?? systemTheme();

// Single source of truth for the active theme. Reads the saved preference (or
// system default) on load, reflects it onto <html data-theme>, persists manual
// choices, and follows OS changes only while the user hasn't overridden.
export const useTheme = () => {
  const [theme, setTheme] = useState(initialTheme);

  // Reflect the active theme onto the root element so the CSS token sets apply.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Track the OS preference, but only auto-apply it when the user has made no
  // manual choice. A stored value is a deliberate override and must stick across
  // system flips until the user toggles again.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (event) => {
      if (readStored()) return;
      setTheme(event.matches ? THEMES.DARK : THEMES.LIGHT);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Manual toggle: flip and persist, so the choice survives refreshes and pins
  // against future system changes.
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Persistence is best-effort; ignore storage failures.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
};
