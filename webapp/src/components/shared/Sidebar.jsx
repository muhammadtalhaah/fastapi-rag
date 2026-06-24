import { useEffect, useRef, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  Ellipsis,
  Library,
  LogIn,
  LogOut,
  MessagesSquare,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/context";
import { useConversations } from "@/hooks";
import { LoginModal } from "@/components/auth";
import { TypewriterText } from "@/components/shared";

// Nav reads like a card-catalog index: each entry has a brass call-number, an
// icon, and a label. Order encodes the natural workflow — ask, browse, add.
const NAV = [
  { to: ROUTES.CHAT, code: "01", label: "Ask", icon: MessagesSquare, end: true },
  { to: ROUTES.DOCUMENTS, code: "02", label: "Documents", icon: Library },
  { to: ROUTES.UPLOAD, code: "03", label: "Upload", icon: UploadCloud },
];

const Sidebar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { conversations, deleteConversation, deletingId, renameConversation } =
    useConversations();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get("c");
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const menuRef = useRef(null);

  // Open a past conversation by setting the ?c= param (ChatPage loads it).
  const openConversation = (id) => setSearchParams({ c: id });

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(null);
    if (editingId === id) {
      setEditingId(null);
      setDraftTitle("");
    }
    deleteConversation(id);
    // If we deleted the open one, drop back to a fresh chat.
    if (id === activeId) setSearchParams({});
  };

  const startEditing = (conversation) => {
    setMenuOpenId(null);
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const submitRename = (conversationId) => {
    const title = draftTitle.trim();
    if (!title) {
      cancelEditing();
      return;
    }
    renameConversation({ id: conversationId, title });
    setEditingId(null);
    setDraftTitle("");
  };

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpenId]);

  return (
    <>
      <aside className="flex h-full shrink-0 flex-col border-r border-rule bg-surface/40 sm_tablet:w-64">
        <div className="border-b border-rule px-6 py-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-brass">
            Retrieval Index
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold leading-none text-ink">
            Athenæum
          </h1>
          <p className="mt-1 text-xs text-muted">Grounded answers, with sources.</p>
        </div>

        <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
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

        {isAuthenticated && conversations.length > 0 ? (
          <div className="flex-1 flex min-h-0 flex-col border-t border-rule">
            <p className="px-6 pb-2 pt-4 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-brass">
              History
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-2">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                const isDeleting = c.id === deletingId;
                const isEditing = c.id === editingId;
                const isMenuOpen = c.id === menuOpenId;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 border px-3 py-2 transition-colors ${
                      isActive
                        ? "border-rule bg-ground text-ink"
                        : "border-transparent text-muted hover:border-rule hover:bg-ground/60 hover:text-ink"
                    } ${isDeleting ? "opacity-50" : ""}`}
                  >
                    {isEditing ? (
                      <form
                        className="min-w-0 flex-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          submitRename(c.id);
                        }}
                      >
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => cancelEditing()}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEditing();
                            }
                          }}
                          autoFocus
                          maxLength={80}
                          className="min-w-0 flex-1 border border-rule bg-surface px-2 py-1 text-xs text-ink outline-none ring-0 placeholder:text-muted focus:border-brass"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className="min-w-0 flex-1 text-left"
                        title={c.title}
                      >
                        <span className="block truncate text-xs">
                          {c.isGeneratingTitle ? (
                            <TypewriterText
                              key={`${c.id}:${c.title}`}
                              text={c.title}
                              speed={28}
                              className="text-xs"
                            />
                          ) : (
                            c.title
                          )}
                        </span>
                      </button>
                    )}
                    <div className="relative shrink-0" ref={isMenuOpen ? menuRef : null}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId((current) => (current === c.id ? null : c.id));
                        }}
                        disabled={isDeleting || isEditing}
                        aria-label="Conversation actions"
                        className="shrink-0 text-rule opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 disabled:opacity-30"
                      >
                        <Ellipsis size={14} />
                      </button>
                      {isMenuOpen ? (
                        <div className="absolute right-0 top-6 z-50 min-w-28 border border-rule bg-surface py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startEditing(c);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink transition-colors hover:bg-ground"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, c.id)}
                            disabled={isDeleting}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger transition-colors hover:bg-ground disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-auto border-t border-rule px-4 py-4">
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
                <p className="truncate font-mono text-[0.6rem] text-muted">
                  {user.email}
                </p>
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
