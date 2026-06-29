import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings as SettingsIcon, Activity, Palette, X } from "lucide-react";
import AccountSettings from "./AccountSettings";
import UsageSettings from "./UsageSettings";
import AppearanceSettings from "./AppearanceSettings";

// Settings dialog opened from the account menu. Two-pane layout matching the
// screenshots: a vertical nav rail on the left (Account / Usage / Appearance)
// and the active panel on the right. Mirrors the LoginModal / SearchModal
// conventions — fixed overlay, hairline-ruled surface, Escape + backdrop-click
// to close, closing owned by the parent (`onClose`).
//
// Rendered through a portal to <body>: the sidebar (where the trigger lives) has
// a CSS transform for its slide/width transition, which would otherwise become
// the containing block for the `fixed` overlay and clip the modal to the rail
// instead of centering it on the viewport.
//
// UI only for now: panels render dummy data and there are no save endpoints.
const TABS = [
  { id: "account", label: "Account", Icon: SettingsIcon },
  { id: "usage", label: "Usage", Icon: Activity },
  { id: "appearance", label: "Appearance", Icon: Palette },
];

const SettingsModal = ({ onClose, user, theme, onToggleTheme }) => {
  const [active, setActive] = useState("account");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ground/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
    >
      <div
        className="flex h-[34rem] max-h-[88vh] w-full max-w-3xl overflow-hidden border border-rule bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left nav rail. */}
        <nav className="flex w-48 shrink-0 flex-col border-r border-rule bg-ground/40 p-3">
          <p className="px-2 pb-2 pt-1 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-brass">
            Settings
          </p>
          {TABS.map(({ id, label, Icon }) => {
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-current={selected ? "page" : undefined}
                className={`flex items-center gap-2.5 px-2 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "bg-surface text-ink ring-1 ring-rule"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Icon size={15} aria-hidden="true" className="shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right content panel. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-rule px-6 py-4">
            <h2
              id="settings-title"
              className="font-display text-xl font-medium text-ink"
            >
              {TABS.find((t) => t.id === active)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="text-muted transition-colors hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
            {active === "account" && <AccountSettings user={user} />}
            {active === "usage" && <UsageSettings />}
            {active === "appearance" && (
              <AppearanceSettings theme={theme} onToggleTheme={onToggleTheme} />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SettingsModal;
