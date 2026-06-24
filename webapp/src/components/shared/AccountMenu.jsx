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
      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-rule"
    />
  ) : (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ground ring-1 ring-rule">
      <span className="font-mono text-xs text-brass">
        {user.name?.[0]?.toUpperCase() ?? "?"}
      </span>
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
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-ground hover:text-ink";

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-full left-0 z-50 mb-2 w-60 max-w-[calc(100vw-2rem)] border border-rule bg-surface py-1 shadow-lg"
        >
          {/* Identity header — user image, name, and email. */}
          <div className="flex items-center gap-3 border-b border-rule px-3 py-3">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate font-mono text-[0.6rem] text-muted">{user.email}</p>
            </div>
          </div>

          <button type="button" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <Settings size={15} aria-hidden="true" className="shrink-0" />
            Settings
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <Globe size={15} aria-hidden="true" className="shrink-0" />
            Language
          </button>

          {/* Theme toggle. Stays open so the user can see the flip / toggle back. */}
          <button type="button" role="menuitem" className={itemClass} onClick={onToggleTheme}>
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
        </div>
      ) : null}

      {/* Trigger — the avatar + name/email row. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user.name : undefined}
        className={`flex w-full items-center gap-3 text-left transition-colors hover:opacity-90 ${
          collapsed ? "sm_tablet:justify-center sm_tablet:gap-0" : ""
        }`}
      >
        <Avatar user={user} />
        <div className={`min-w-0 flex-1 overflow-hidden ${labelTransition} ${collapsedHide}`}>
          <p className="truncate text-xs font-medium text-ink">{user.name}</p>
          <p className="truncate font-mono text-[0.6rem] text-muted">{user.email}</p>
        </div>
      </button>
    </div>
  );
};

export default AccountMenu;
