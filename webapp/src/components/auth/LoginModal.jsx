import GoogleButton from "./GoogleButton";
import { useEffect, useState } from "react";
import { useAuth, useTranslation } from "@/context";
import { Eye, EyeOff, LogIn, X } from "lucide-react";
import { AppButton, AppInput } from "@/components/shared";

// Login dialog. Mirrors the ConfirmDelete modal conventions — fixed overlay,
// hairline-ruled surface panel, Escape + backdrop-click to close, focus moved
// into the form on open. Credentials submit to the session-cookie backend; on
// success the cookie is set and the modal closes.
const LoginModal = ({ onClose }) => {
  const { login, isLoggingIn, loginError, resetLoginError, oauthError, clearOauthError } =
    useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
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
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
              {t("accountLabel")}
            </span>
            <h2
              id="login-title"
              className="mt-2 font-display text-xl font-medium text-ink"
            >
              {t("signInTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeLabel")}
            className="text-muted transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t("signInDescription")}
        </p>

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-medium text-muted">
              {t("emailLabel")}
            </label>
            <AppInput
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-none bg-ground hover:bg-ground hover:border-primary text-sm text-ink placeholder:text-muted focus-within:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-medium text-muted">
              {t("passwordLabel")}
            </label>
            <AppInput
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ground hover:bg-ground hover:border-primary rounded-none text-sm text-ink placeholder:text-muted focus-within:border-primary"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  className="text-muted transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <AppButton variant="ghost" onClick={onClose} type="button">
              {t("cancel")}
            </AppButton>
            <AppButton type="submit" disabled={isLoggingIn}>
              <LogIn size={16} />
              {isLoggingIn ? t("signingIn") : t("signIn")}
            </AppButton>
          </div>
        </form>

        {/* Alternative sign-in. The divider separates the password form from
            the OAuth path; both end in the same server-side session. */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-rule" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
            {t("orDivider")}
          </span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <GoogleButton disabled={isLoggingIn} />
      </div>
    </div>
  );
};

export default LoginModal;
