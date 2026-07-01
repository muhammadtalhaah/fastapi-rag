/* eslint-disable react-refresh/only-export-components -- provider + its hooks are intentionally colocated */
import { createContext, useContext, useMemo } from "react";
import { useTheme, usePreferences } from "@/hooks";
import { translate } from "@/language";

// Appearance preferences are genuinely global (they reskin the whole app via
// attributes on <html>) so they live in context like auth and layout. The
// provider runs useTheme() + usePreferences() exactly once at the root; every
// consumer shares that single state and the same localStorage-backed setters.
//
// This supersedes the old ThemeContext: it still exposes { theme, toggleTheme }
// for existing callers (AccountMenu's quick toggle), and adds the appearance
// mode, accent, chat font, language, and a t() translator.
const PreferencesContext = createContext(null);

export const PreferencesProvider = ({ children }) => {
  const themeApi = useTheme();
  const prefs = usePreferences();

  // t(key) resolves against the active language, falling back to English.
  const t = useMemo(
    () => (key) => translate(prefs.language, key),
    [prefs.language],
  );

  const value = useMemo(
    () => ({ ...themeApi, ...prefs, t }),
    [themeApi, prefs, t],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

const usePreferencesContext = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error(
      "usePreferencesContext must be used within a PreferencesProvider",
    );
  }
  return ctx;
};

export { usePreferencesContext };

// Back-compat alias: existing theme consumers keep importing useThemeContext and
// get { theme, mode, setThemeMode, toggleTheme, ... } from the same provider.
export const useThemeContext = usePreferencesContext;

// Convenience hook for components that only need the translator.
export const useTranslation = () => {
  const { t, language, isRtl } = usePreferencesContext();
  return { t, language, isRtl };
};
