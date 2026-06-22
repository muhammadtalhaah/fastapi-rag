import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import { MessagesSquare, Library, UploadCloud, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/context";
import { LoginModal } from "@/components/auth";

// Nav reads like a card-catalog index: each entry has a brass call-number, an
// icon, and a label. Order encodes the natural workflow — ask, browse, add.
const NAV = [
  { to: ROUTES.CHAT, code: "01", label: "Ask", icon: MessagesSquare, end: true },
  { to: ROUTES.DOCUMENTS, code: "02", label: "Documents", icon: Library },
  { to: ROUTES.UPLOAD, code: "03", label: "Upload", icon: UploadCloud },
];

const Sidebar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <aside className="flex shrink-0 flex-col border-r border-rule bg-surface/40 sm_tablet:w-64">
        <div className="border-b border-rule px-6 py-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-brass">
            Retrieval Index
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold leading-none text-ink">
            Athenæum
          </h1>
          <p className="mt-1 text-xs text-muted">Grounded answers, with sources.</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
          {NAV.map(({ to, code, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 border px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "border-rule bg-ground text-ink"
                    : "border-transparent text-muted hover:border-rule hover:bg-ground/60 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`font-mono text-xs ${
                      isActive ? "text-brass" : "text-rule group-hover:text-brass"
                    }`}
                  >
                    {code}
                  </span>
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-medium tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-rule px-4 py-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {user.profileUrl ? (
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
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{user.name}</p>
                <p className="truncate font-mono text-[0.6rem] text-muted">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="shrink-0 text-muted transition-colors hover:text-ink"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="flex w-full items-center gap-2 border border-rule px-3 py-2 text-sm text-muted transition-colors hover:border-brass hover:text-ink"
            >
              <LogIn size={15} aria-hidden="true" />
              <span className="font-medium">Sign in</span>
            </button>
          )}
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
};

export default Sidebar;
