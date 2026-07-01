import {
  X,
  LogIn,
  Search,
  Library,
  UploadCloud,
  PanelLeftOpen,
  MessagesSquare,
  MessageSquareText,
  PanelLeftClose,
} from "lucide-react";
import AccountMenu from "./AccountMenu";
import SearchModal from "./SearchModal";
import { ROUTES } from "@/config/routes";
import { useEffect, useState } from "react";
import SidebarRecents from "./SidebarRecents";
import { LoginModal } from "@/components/auth";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useLayout, useThemeContext, useTranslation } from "@/context";

// Nav reads like a card-catalog index: each entry has a brass call-number, an
// icon, and a label key (resolved through t() so labels follow the language).
// Order encodes the natural workflow — ask, browse, add. `authOnly` entries are
// hidden from guests (uploading requires signing in).
const NAV = [
  { to: ROUTES.CHAT, code: "01", labelKey: "navAsk", icon: MessagesSquare, end: true },
  {
    to: ROUTES.CHATS,
    code: "02",
    labelKey: "navChats",
    icon: MessageSquareText,
    authOnly: true,
  },
  { to: ROUTES.DOCUMENTS, code: "03", labelKey: "navDocuments", icon: Library },
  { to: ROUTES.UPLOAD, code: "04", labelKey: "navUpload", icon: UploadCloud, authOnly: true },
];

// The catalog rail. One component, two responsive personalities driven by
// LayoutContext:
//   - mobile  (< sm_tablet): fixed off-canvas drawer, slides over a backdrop.
//   - tablet+ (sm_tablet)  : persistent rail; collapses to an icon-only mini rail.
const Sidebar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeContext();
  const { user, isAuthenticated, logout } = useAuth();
  const { isMobileOpen, closeMobile, isRailCollapsed, toggleRail } = useLayout();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  const [showLogin, setShowLogin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Opening a route from the drawer should close it; do it on every navigation
  // so links, recents, and back/forward all dismiss the mobile overlay.
  useEffect(() => {
    closeMobile();
  }, [location.pathname, location.search, closeMobile]);

  // ESC closes the mobile drawer.
  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileOpen, closeMobile]);

  // Collapsed only applies on tablet+; the drawer always shows full content.
  const collapsed = isRailCollapsed;

  // Guests don't see upload-only nav entries (uploading requires signing in).
  const navItems = NAV.filter((item) => !item.authOnly || isAuthenticated);

  // Cmd/Ctrl-click (or middle-click) should open the route in a new browser tab
  // instead of navigating in place. NavLink renders a real <a href>, so we just
  // let those modified clicks fall through to the browser by short-circuiting
  // before React Router's SPA navigation can intercept and close the drawer.
  const openInNewTabOnModifiedClick = (e, to) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      window.open(to, "_blank", "noopener,noreferrer");
    }
  };

  // "Ask" routes to the chat root ("/"), but opening or starting a conversation
  // only adds a ?c=<id> query param — the pathname stays "/". NavLink matches on
  // pathname alone, so it would keep "Ask" highlighted while you're in a chat.
  // Treat "Ask" as active only on a fresh chat (no ?c= param); de-highlight it
  // once a conversation is open.
  const inConversation = new URLSearchParams(location.search).has("c");

  // Text labels animate rather than snap. We keep them in the DOM and transition
  // opacity + max-width + translate so the rail width and the text stay in sync.
  // On expand the labels fade in with a short delay (after the rail has widened),
  // which removes the "flutter"; on collapse they fade out immediately.
  const labelTransition =
    "transition-[opacity,max-width,transform] duration-200 ease-in-out motion-reduce:transition-none";
  // Applied to a label wrapper: hidden+clipped when collapsed (tablet+), shown otherwise.
  const collapsedHide = collapsed
    ? "hidden sm_tablet:max-w-0 sm_tablet:-translate-x-1 sm_tablet:opacity-0 sm_tablet:pointer-events-none"
    : "block max-w-[16rem] translate-x-0 opacity-100 delay-150 sm_tablet:delay-150";

  return (
    <>
      <aside
        aria-label="Catalog navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-rule bg-surface backdrop-blur transition-[transform,width] duration-300 ease-in-out
          w-72 max-w-[85vw]
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          sm_tablet:static sm_tablet:z-auto sm_tablet:max-w-none sm_tablet:translate-x-0 sm_tablet:bg-surface/40
          ${collapsed ? "sm_tablet:w-16" : "sm_tablet:w-64"}`}
      >
        {/* Masthead. Collapsed (tablet+) it's a single centered button showing the
            Æ mark, which swaps to the expand icon on hover/focus. Expanded, the
            full wordmark sits left with the collapse toggle on the right. */}
        <div
          className={`flex items-start justify-between gap-2 border-b border-rule py-6 ${
            collapsed ? "px-3 sm_tablet:px-2" : "px-4 sm_tablet:px-6"
          }`}
        >
          {/* Full wordmark — fades/slides away as the rail collapses. */}
          <div className={`min-w-0 overflow-hidden ${labelTransition} ${collapsedHide} `}>
            <p className="whitespace-nowrap font-mono text-[0.65rem] uppercase tracking-[0.3em] text-primary">
              {t("retrievalIndex")}
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-none text-ink">
              Athenæum
            </h1>
            <p className="mt-1 whitespace-nowrap text-xs text-muted">
              {t("tagline")}
            </p>
          </div>

          {/* Close button — drawer only. */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label={t("closeNavigation")}
            className="shrink-0 text-muted transition-colors hover:text-ink sm_tablet:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>

          {/* Collapse / expand toggle — tablet+ only. When collapsed it fills the
              header centered, showing Æ by default and the expand icon on hover. */}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            aria-pressed={collapsed}
            className={`group/toggle hidden shrink-0 text-muted transition-colors hover:text-ink sm_tablet:block ${
              collapsed
                ? "sm_tablet:relative sm_tablet:mx-auto sm_tablet:grid sm_tablet:h-9 sm_tablet:w-9 sm_tablet:place-items-center hover:!bg-ground border border-transparent hover:border-rule cursor-e-resize"
                : "cursor-w-resize"
            }`}
          >
            {collapsed ? (
              <>
                <span className="col-start-1 row-start-1 font-display text-xl font-semibold leading-none text-ink transition-opacity group-hover/toggle:opacity-0 group-focus-visible/toggle:opacity-0">
                  Æ
                </span>
                <PanelLeftOpen
                  size={18}
                  aria-hidden="true"
                  className="col-start-1 row-start-1 opacity-0 transition-opacity group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100"
                />
              </>
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className=" flex flex-col gap-1 p-3" aria-label="Primary">
          {navItems.map(({ to, code, labelKey, icon: Icon, end }) => {
            const label = t(labelKey);
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              onClick={(e) => openInNewTabOnModifiedClick(e, to)}
              onAuxClick={(e) => openInNewTabOnModifiedClick(e, to)}
              className={({ isActive }) => {
                // "Ask" (the chat root) shouldn't read as active once a
                // conversation is open — the ?c= param keeps the pathname at "/".
                const active = isActive && !(to === ROUTES.CHAT && inConversation);
                return `group flex items-center gap-3 border px-3 py-3 text-sm transition-colors ${
                  collapsed
                    ? "sm_tablet:justify-center sm_tablet:gap-0 sm_tablet:px-0"
                    : ""
                } ${
                  active
                    ? "border-rule bg-ground text-ink"
                    : "border-transparent text-muted hover:border-rule hover:bg-ground/60 hover:text-ink"
                }`;
              }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`overflow-hidden font-mono text-xs ${labelTransition} ${collapsedHide} ${
                      isActive && !(to === ROUTES.CHAT && inConversation)
                        ? "text-primary"
                        : "text-rule group-hover:text-primary"
                    }`}
                  >
                    {code}
                  </span>
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span
                    className={`overflow-hidden whitespace-nowrap font-medium tracking-wide ${labelTransition} ${collapsedHide}`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
            );
          })}
        </nav>

        {/* Recents heading + list. On the collapsed mini rail it fades out and is
            then removed from layout (after the fade) so the icons stay centered. */}
        {isAuthenticated && (
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
              collapsed
                ? "sm_tablet:pointer-events-none sm_tablet:opacity-0"
                : "opacity-100 delay-150"
            }`}
          >
            <div className=" flex items-center justify-between border-t border-rule px-6 py-3">
              <p className="whitespace-nowrap font-mono text-[0.6rem] uppercase tracking-[0.3em] text-primary">
                {t("recents")}
              </p>

              <button
                type="button"
                onClick={() => setShowSearch(true)}
                aria-label={t("searchConversations")}
                title={t("searchConversations")}
                className="-mr-1 shrink-0 text-muted transition-colors hover:text-ink"
              >
                <Search size={14} aria-hidden="true" />
              </button>
            </div>
            <SidebarRecents onNavigate={closeMobile} />
          </div>
        )}

        {/* Account footer. When signed in, the theme toggle lives inside the
            account popup; guests get a standalone toggle next to Sign in. */}
        <div
          className={`mt-auto border-t border-rule ${isAuthenticated ? "p-0" : "p-4"}`}
        >
          {isAuthenticated ? (
            <AccountMenu
              user={user}
              onLogout={handleLogout}
              theme={theme}
              onToggleTheme={toggleTheme}
              collapsed={collapsed}
              labelTransition={labelTransition}
              collapsedHide={collapsedHide}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              title={collapsed ? t("signIn") : undefined}
              className={`flex w-full cursor-pointer items-center gap-2 border border-rule px-3 py-2 bg-ground text-sm text-muted transition-colors hover:border-primary hover:text-ink ${
                collapsed ? "sm_tablet:justify-center sm_tablet:gap-0 sm_tablet:px-0" : ""
              }`}
            >
              <LogIn size={15} aria-hidden="true" className="shrink-0" />
              <span
                className={`overflow-hidden whitespace-nowrap font-medium ${labelTransition} ${collapsedHide}`}
              >
                {t("signIn")}
              </span>
            </button>
          )}
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  );
};

export default Sidebar;
