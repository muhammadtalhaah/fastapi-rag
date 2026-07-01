import { LogIn, X } from "lucide-react";

// Closeable inline banner nudging anonymous users to sign in. Chatting still
// works while logged out (the backend allows it), so this is a soft prompt the
// user can dismiss — not a blocking gate. Dismissal is owned by the parent so
// it can persist for the session.
const LoginPrompt = ({ onLogin, onDismiss }) => {
  return (
    <div
      className="flex items-center justify-between gap-3 border border-rule bg-surface px-3 py-2"
      role="status"
    >
      <p className="text-xs leading-relaxed text-muted">
        You’re chatting as a guest.{" "}
        <button
          type="button"
          onClick={onLogin}
          className="!min-w-fit font-medium text-primary underline-offset-2 hover:underline"
        >
          Sign in
        </button>{" "}
        to save your conversations.
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onLogin}
          className="min-w-fit flex items-center gap-1.5 border border-rule p-2 text-xs text-ink transition-colors hover:border-primary"
        >
          <LogIn size={13} />
          Sign in
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="p-1 text-muted transition-colors hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default LoginPrompt;
