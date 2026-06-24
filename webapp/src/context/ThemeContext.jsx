/* eslint-disable react-refresh/only-export-components -- provider + its hook are intentionally colocated */
import { createContext, useContext } from "react";
import { useTheme } from "@/hooks";

// Theme is genuinely global state (it reskins the whole app via [data-theme] on
// <html>), so it lives in context like auth and layout. The provider calls
// useTheme() exactly once at the root; every consumer shares that single state
// instead of spinning up its own listener/storage logic.
const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return ctx;
};
