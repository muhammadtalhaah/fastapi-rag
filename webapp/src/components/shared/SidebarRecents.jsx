import { useAuth, useTranslation } from "@/context";
import { ROUTES } from "@/config/routes";
import { useConversations } from "@/hooks";
import SidebarSkeleton from "./SidebarSkeleton";
import { useState } from "react";
import { AppDropdown, TypewriterText } from "@/components/shared";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ellipsis, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

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
    pinConversation,
  } = useConversations();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const activeId = searchParams.get("c");

  const [draftTitle, setDraftTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  // Id of the row whose actions menu is open (one at a time across the list),
  // or null when none is open.
  const [openMenuId, setOpenMenuId] = useState(null);

  // A conversation lives at "/?c=<id>". Cmd/Ctrl-click (or middle-click) should
  // open that URL in a new browser tab instead of navigating in place. Rows are
  // <div>s (not <a>s), so there's no native href to fall back on — we read the
  // modifier keys off the event ourselves and window.open when present.
  const openConversation = (id, e) => {
    const href = `${ROUTES.CHAT}?c=${id}`;
    if (e && (e.metaKey || e.ctrlKey || e.button === 1)) {
      e.preventDefault();
      e.stopPropagation();
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(href);
    onNavigate?.();
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(null);
    if (editingId === id) {
      setEditingId(null);
      setDraftTitle("");
    }
    deleteConversation(id);
    if (id === activeId) setSearchParams({});
  };

  const handlePin = (e, conversation) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(null);
    pinConversation({ id: conversation.id, pinned: !conversation.pinned });
  };

  const startEditing = (conversation) => {
    setOpenMenuId(null);
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

  if (!isAuthenticated) return null;
  if (isHistoryLoading) return <SidebarSkeleton />;
  if (conversations.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          const isDeleting = c.id === deletingId;
          const isEditing = c.id === editingId;
          const menuItems = [
            {
              key: "pin",
              icon: c.pinned ? <PinOff size={14} /> : <Pin size={14} />,
              label: c.pinned ? t("unpin") : t("pin"),
              onClick: ({ domEvent }) => handlePin(domEvent, c),
            },
            {
              key: "edit",
              icon: <Pencil size={14} />,
              label: t("edit"),
              onClick: ({ domEvent }) => {
                domEvent.preventDefault();
                domEvent.stopPropagation();
                startEditing(c);
              },
            },
            { type: "divider", key: "delete-divider" },
            {
              key: "delete",
              danger: true,
              disabled: isDeleting,
              icon: <Trash2 size={14} />,
              label: t("delete"),
              onClick: ({ domEvent }) => handleDelete(domEvent, c.id),
            },
          ];
          return (
            <div
              key={c.id}
              onClick={(e) => openConversation(c.id, e)}
              onAuxClick={(e) => openConversation(c.id, e)}
              className={`group flex cursor-pointer items-center gap-2 border p-1 px-2 transition-colors ${
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
                    className="min-w-0 flex-1 border border-rule bg-surface px-2 py-1 text-xs text-ink outline-none ring-0 placeholder:text-muted focus:border-primary"
                  />
                </form>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-1 text-left" title={c.title}>
                  {c.pinned ? (
                    <Pin size={12} className="shrink-0 text-primary" aria-label="Pinned" />
                  ) : null}
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
              <AppDropdown
                open={openMenuId === c.id}
                onOpenChange={(next) => setOpenMenuId(next ? c.id : null)}
                disabled={isDeleting || isEditing}
                menu={{ items: menuItems, className: "w-32" }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  disabled={isDeleting || isEditing}
                  aria-label={t("conversationActions")}
                  className={`shrink-0 text-rule opacity-100 transition-opacity hover:text-ink disabled:opacity-30 sm_tablet:opacity-0  hover:bg-surface sm_tablet:group-hover:opacity-100 rounded-full p-1 ${openMenuId === c.id ? "bg-surface sm_tablet:!opacity-100 !text-ink" : ""}`}
                >
                  <Ellipsis size={14} />
                </button>
              </AppDropdown>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SidebarRecents;
