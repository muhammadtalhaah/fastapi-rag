import { useEffect, useRef, useState } from "react";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import { getInitials } from "@/helpers";
import { useTranslation } from "@/context";
import { SettingsModal } from "@/components/settings";
import { Globe, LogOut, Moon, Settings, Sun } from "lucide-react";

// The account control in the sidebar footer. The avatar + name/email row is a
// button that opens a popover above it (the footer sits at the bottom of the
// rail) with the user's identity, Settings, Language, and Logout.
//
// The popover surface is AppCard — the same floating-card component the
// composer "+" menu uses — with open/close, outside-click, and Escape handled
// here directly (mirroring ComposerMenu) instead of delegating to antd's
// Dropdown/Menu. The identity header is non-interactive; every other row
// closes the popover on click.
//
// Settings opens the SettingsModal (Account / Usage / Appearance); Language is a
// placeholder for now (no destination yet); Logout is wired to the real auth
// action. `collapsed` mirrors the mini-rail behavior used elsewhere in the
// sidebar.
// Single source of truth for avatar sizing so the image and initials variants
// never drift apart. `sm` fits the compact CTA row; `md` suits the card header.
const AVATAR = {
  sm: { box: "h-8 w-8", text: "text-xs" },
  md: { box: "h-10 w-10", text: "text-sm" },
};

const Avatar = ({ user, size = "md" }) => {
  const { box, text } = AVATAR[size] ?? AVATAR.md;
  return user.profileUrl ? (
    <img
      src={user.profileUrl}
      alt={user.name}
      className={`${box} shrink-0 rounded-full object-cover ring-1 ring-rule`}
    />
  ) : (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-ground ring-1 ring-rule`}
    >
      <span className={`font-mono ${text} text-primary`}>{getInitials(user.name)}</span>
    </div>
  );
};

const AccountMenu = ({
  user,
  onLogout,
  theme,
  onToggleTheme,
  collapsed,
  labelTransition,
  collapsedHide,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const itemClass =
    "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-ink";

  const closeAnd = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <AppCard className="w-[15rem] py-1" aria-label="Account menu">
          {/* Identity header — non-interactive. */}
          <div className="flex items-center gap-3 border-b border-rule px-3 py-3">
            <Avatar user={user} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="truncate font-mono text-[0.65rem] text-muted">{user.email}</p>
            </div>
          </div>

          <button type="button" onClick={closeAnd(() => setShowSettings(true))} className={itemClass}>
            <Settings size={15} aria-hidden="true" className="shrink-0" />
            {t("settings")}
          </button>

          <button type="button" onClick={closeAnd()} className={itemClass}>
            <Globe size={15} aria-hidden="true" className="shrink-0" />
            {t("language")}
          </button>

          <button type="button" onClick={closeAnd(onToggleTheme)} className={itemClass}>
            {theme === "dark" ? (
              <Sun size={15} aria-hidden="true" className="shrink-0" />
            ) : (
              <Moon size={15} aria-hidden="true" className="shrink-0" />
            )}
            {theme === "dark" ? t("lightTheme") : t("darkTheme")}
          </button>

          <div className="my-1 h-px bg-rule" />

          <button type="button" onClick={closeAnd(onLogout)} className={itemClass}>
            <LogOut size={15} aria-hidden="true" className="shrink-0" />
            {t("logout")}
          </button>
        </AppCard>
      ) : null}

      {/* Trigger — the avatar + name/email row. */}
      <AppButton
        variant="plain"
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user.name : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`w-full justify-start !gap-2.5 rounded-none !p-4 text-left hover:bg-ground ${
          open ? "!bg-ground" : "bg-transparent"
        } ${collapsed ? "sm_tablet:justify-center sm_tablet:gap-0" : ""}`}
      >
        <Avatar user={user} size="sm" />
        <div
          className={`min-w-0 flex-1 overflow-hidden ${labelTransition} ${collapsedHide}`}
        >
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-[0.7rem] leading-tight text-muted">
            {t("freePlan")}
          </p>
        </div>
        {!collapsed && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 256 256"
            className="shrink-0"
          >
            <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z"></path>
          </svg>
        )}
      </AppButton>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} user={user} />
      )}
    </div>
  );
};

export default AccountMenu;
