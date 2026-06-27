import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/context";
import { useConversations } from "@/hooks";
import { TypewriterText } from "@/components/shared";
import SidebarSkeleton from "./SidebarSkeleton";

// The "Recents" rail section: the scrollable list of past conversations with
// per-row rename/delete. Extracted from Sidebar to keep each file focused and
// under the 300-line component budget.
//
// `onNavigate` lets the parent close the mobile drawer once a conversation is
// opened. Hidden entirely when the rail is collapsed to its icon-only state.
const SidebarRecents = ({ onNavigate }) => {
  const { isAuthenticated } = useAuth();
  const {
    conversations,
    isLoading: isHistoryLoading,
    deleteConversation,
    deletingId,
    renameConversation,
  } = useConversations();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeId = searchParams.get("c");

  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const menuRef = useRef(null);

  const openConversation = (id) => {
    navigate(`${ROUTES.CHAT}?c=${id}`);
    onNavigate?.();
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(null);
    if (editingId === id) {
      setEditingId(null);
      setDraftTitle("");
    }
    deleteConversation(id);
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

  if (!isAuthenticated) return null;
  if (isHistoryLoading) return <SidebarSkeleton />;
  if (conversations.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          const isDeleting = c.id === deletingId;
          const isEditing = c.id === editingId;
          const isMenuOpen = c.id === menuOpenId;
          return (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`group flex cursor-pointer items-center gap-2 border p-1 transition-colors ${
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
                <div className="min-w-0 flex-1 text-left" title={c.title}>
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
                </div>
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
                  className="shrink-0 text-rule opacity-100 transition-opacity hover:text-ink disabled:opacity-30 sm_tablet:opacity-0 sm_tablet:group-hover:opacity-100"
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
  );
};

export default SidebarRecents;
