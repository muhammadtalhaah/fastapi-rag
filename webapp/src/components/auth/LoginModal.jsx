import { useEffect, useRef, useState } from "react";
import { LogIn, X } from "lucide-react";
import { AppButton } from "@/components/shared";
import { useAuth } from "@/context";
import GoogleButton from "./GoogleButton";

// Login dialog. Mirrors the ConfirmDelete modal conventions — fixed overlay,
// hairline-ruled surface panel, Escape + backdrop-click to close, focus moved
// into the form on open. Credentials submit to the session-cookie backend; on
// success the cookie is set and the modal closes.
const LoginModal = ({ onClose }) => {
  const { login, isLoggingIn, loginError, resetLoginError, oauthError, clearOauthError } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Clear any stale "Invalid credentials" error when unmounting so it doesn't
  // flash on reopen. Also clear any Google OAuth error once it's been shown.
  useEffect(
    () => () => {
      resetLoginError?.();
      clearOauthError?.();
    },
    [resetLoginError, clearOauthError],
  );

  // The password form error takes precedence; otherwise show any OAuth error.
  const errorMessage = loginError || oauthError;

  const submit = async (e) => {
    e.preventDefault();
    if (isLoggingIn || !email.trim() || !password) return;
    try {
      await login(email.trim(), password);
      onClose(); // success — cookie set, close the dialog
    } catch {
      // Error is surfaced via loginError from context; keep the modal open.
    }
  };

  const inputClass =
    "w-full border border-rule bg-ground px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-retrieval focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-rule bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
              Account
            </span>
            <h2
              id="login-title"
              className="mt-2 font-display text-xl font-medium text-ink"
            >
              Sign in
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sign in to save your conversations and access them across devices.
        </p>

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-medium text-muted">
              Email
            </label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-medium text-muted">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <AppButton variant="ghost" onClick={onClose} type="button">
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={isLoggingIn}>
              <LogIn size={16} />
              {isLoggingIn ? "Signing in…" : "Sign in"}
            </AppButton>
          </div>
        </form>

        {/* Alternative sign-in. The divider separates the password form from
            the OAuth path; both end in the same server-side session. */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-rule" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
            or
          </span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <GoogleButton disabled={isLoggingIn} />
      </div>
    </div>
  );
};

export default LoginModal;
