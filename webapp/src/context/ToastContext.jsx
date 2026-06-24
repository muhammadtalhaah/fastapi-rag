/* eslint-disable react-refresh/only-export-components -- provider + its hook are intentionally colocated */
import { AlertTriangle, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Lightweight app-wide toast feedback. The project has no UI component library
// installed, so this is a small self-contained implementation styled with the
// existing design tokens. Toasts auto-dismiss and can be dismissed manually.
const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

let nextId = 1;
const makeId = () => `t${nextId++}`;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message, { variant = "error", duration = DEFAULT_DURATION } = {}) => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2 border border-danger/40 bg-surface px-4 py-3 shadow-lg"
          >
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-danger"
              aria-hidden="true"
            />
            <p className="flex-1 text-sm text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-muted transition-colors hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
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
