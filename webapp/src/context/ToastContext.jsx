/* eslint-disable react-refresh/only-export-components -- provider + its hook are intentionally colocated */
import { createContext, useCallback, useContext, useMemo } from "react";
import { Toaster, toast } from "sonner";
import { useThemeContext } from "./PreferencesContext";

// App-wide toast feedback, backed by Sonner. We keep the original
// useToast() -> { showToast, dismiss } surface so call sites don't care that
// Sonner is the engine underneath; ToastProvider just mounts Sonner's <Toaster>
// configured for this app (top-right, themed to the active palette).
//
// Colors map to the message type via Sonner's `richColors`:
//   error   -> red      warning -> yellow
//   info    -> blue     default -> neutral (white in light / near-black in dark)
const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

// Map our `variant` to a Sonner method. Default stays "error" to match the
// previous behavior (showToast was error-styled by default).
const VARIANT_FN = {
  error: toast.error,
  success: toast.success,
  info: toast.info,
  warning: toast.warning,
  default: toast,
};

export function ToastProvider({ children }) {
  const { theme } = useThemeContext();

  const showToast = useCallback(
    (message, { variant = "error", duration = DEFAULT_DURATION } = {}) => {
      const fn = VARIANT_FN[variant] ?? VARIANT_FN.error;
      return fn(message, { duration });
    },
    [],
  );

  const dismiss = useCallback((id) => toast.dismiss(id), []);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        theme={theme}
        richColors
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
