import AppCard from "./AppCard";
import { getInitials } from "@/helpers";
import { useEffect, useRef, useState } from "react";
import { Globe, LogOut, Moon, Settings, Sun } from "lucide-react";

// The account control in the sidebar footer. The avatar + name/email row is a
// button that opens a popover above it (the footer sits at the bottom of the
// rail) with the user's identity, Settings, Language, and Logout.
//
// Built as a self-contained popover in the existing React + Tailwind idiom
// (matching LoginModal / ConfirmDelete) rather than Ant Design's Dropdown:
// antd isn't a dependency in this project, and pulling it in for one menu would
// also require bridging its theme system to the app's CSS-variable themes.
//
// Settings and Language are placeholders for now (no destination yet); Logout is
// wired to the real auth action. `collapsed` mirrors the mini-rail behavior used
// elsewhere in the sidebar.
const Avatar = ({ user }) =>
  user.profileUrl ? (
    <img
      src={user.profileUrl}
      alt={user.name}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-rule"
    />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ground ring-1 ring-rule">
      <h4 className="font-mono text-base text-brass">{getInitials(user.name)}</h4>
    </div>
  );

const AccountMenu = ({
  user,
  onLogout,
  theme,
  onToggleTheme,
  collapsed,
  labelTransition,
  collapsedHide,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on Escape or a click outside the trigger+popover.
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
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted transition-colors";

  return (
    <div
      ref={containerRef}
      onClick={() => setOpen((prev) => !prev)}
      className={`relative p-4 hover:bg-ground cursor-pointer ${open ? "bg-ground" : "bg-transparent"}`}
    >
      {open ? (
        <AppCard className="w-[16rem] py-1 !-left-0 !bottom-13" aria-label="Account">
          {/* Identity header — user image, name, and email. */}
          <div className="flex items-center gap-3 border-b border-rule px-3 py-3">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate font-mono text-[0.6rem] text-muted">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <Settings size={15} aria-hidden="true" className="shrink-0" />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <Globe size={15} aria-hidden="true" className="shrink-0" />
            Language
          </button>

          {/* Theme toggle. Stays open so the user can see the flip / toggle back. */}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? (
              <Sun size={15} aria-hidden="true" className="shrink-0" />
            ) : (
              <Moon size={15} aria-hidden="true" className="shrink-0" />
            )}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </button>

          <div className="my-1 border-t border-rule" />

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={15} aria-hidden="true" className="shrink-0" />
            Logout
          </button>
        </AppCard>
      ) : null}

      {/* Trigger — the avatar + name/email row. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user.name : undefined}
        className={`flex w-full items-center gap-3 text-left transition-colors ${
          collapsed ? "sm_tablet:justify-center sm_tablet:gap-0" : ""
        }`}
      >
        <Avatar user={user} />
        <div
          className={`min-w-0 flex-1 overflow-hidden space-y-px ${labelTransition} ${collapsedHide}`}
        >
          <p className="truncate text-sm font-normal font-[Inter] text-ink">
            {user.name}
          </p>
          <p className="truncate text-xs text-muted">Free plan</p>
        </div>
        {!collapsed && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 256 256"
            class="flex-shrink-0"
          >
            <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z"></path>
          </svg>
        )}
      </button>
    </div>
  );
};

export default AccountMenu;
