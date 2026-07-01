import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageSquareText, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import { PageHeader, StateBlock, AppButton, AppSelect } from "@/components/shared";
import { ChatRow, ConfirmBulkDelete } from "@/components/chats";
import { ROUTES } from "@/config";
import { useTranslation } from "@/context";
import { useConversations } from "@/hooks";

// The Chats manager: a full-page view of the user's conversation history with a
// filter (All / Pinned), title search, a multi-select "Select chats" mode for
// bulk deletion, and a New chat shortcut. The route is auth-gated, so the list
// owner is always signed in. Filter and search persist in URL query params so
// the view is shareable and survives reload.
const ConversationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    conversations,
    isLoading,
    isError,
    refresh,
    deleteConversations,
    isBulkDeleting,
  } = useConversations();

  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter") === "pinned" ? "pinned" : "all";
  const search = searchParams.get("q") ?? "";

  const FILTER_OPTIONS = useMemo(
    () => [
      { value: "all", label: t("filterAll") },
      { value: "pinned", label: t("filterPinned") },
    ],
    [t],
  );

  // Selection mode is transient UI, not route state — selecting chats isn't
  // something to deep-link or restore on reload.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  // Filter by pinned, then by case-insensitive title match. The full list is
  // already in cache (newest-first, pinned-on-top), so filtering is client-side.
  const visibleChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "pinned" && !c.pinned) return false;
      if (term && !c.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [conversations, filter, search]);

  const openChat = (id) => navigate(`${ROUTES.CHAT}?c=${id}`);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // "Select all" is scoped to the currently visible (filtered) chats, so it
  // never silently selects rows the user can't see. Toggles between all/none.
  const allVisibleSelected =
    visibleChats.length > 0 && visibleChats.every((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedIds(
      allVisibleSelected ? new Set() : new Set(visibleChats.map((c) => c.id)),
    );
  };

  const confirmDelete = () => {
    deleteConversations([...selectedIds], {
      onSuccess: () => {
        setConfirmOpen(false);
        exitSelectMode();
      },
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="02 · Chats"
        title={t("chats")}
        lede="Your conversation history. Search, filter, reopen, or clear out chats you no longer need."
        actions={
          <AppButton onClick={() => navigate(ROUTES.CHAT)}>
            <Plus size={16} aria-hidden="true" />
            {t("newChat")}
          </AppButton>
        }
      />

      {/* Toolbar: filter + select/delete on the left side of state. In select
          mode the controls swap to a selection summary and bulk actions. */}
      <div className="flex flex-col gap-3 sm_tablet:flex-row sm_tablet:items-center sm_tablet:justify-between">
        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <AppButton variant="ghost" onClick={toggleSelectAll}>
              {allVisibleSelected ? "Clear all" : "Select all"}
            </AppButton>
            <span className="text-sm text-muted">{selectedCount} selected</span>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="font-mono text-xs uppercase tracking-wide">
              {t("filterBy")}
            </span>
            <AppSelect
              size="middle"
              value={filter}
              variant="borderless"
              options={FILTER_OPTIONS}
              onChange={(v) => setParam("filter", v === "all" ? "" : v)}
              aria-label="Filter chats"
              popupMatchSelectWidth={false}
              className="min-w-24"
            />
          </label>
        )}

        <div className="flex shrink-0 gap-2">
          {selectMode ? (
            <>
              <AppButton
                variant="danger"
                disabled={selectedCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </AppButton>
              <AppButton variant="ghost" onClick={exitSelectMode}>
                <X size={16} aria-hidden="true" />
                {t("cancel")}
              </AppButton>
            </>
          ) : (
            <AppButton
              variant="ghost"
              disabled={conversations.length === 0}
              onClick={() => setSelectMode(true)}
            >
              {t("selectChats")}
            </AppButton>
          )}
        </div>
      </div>

      {/* Search by title. Plain client-side filter over the loaded list. */}
      <div className="flex items-center gap-2 border border-rule bg-surface px-3 py-2">
        <Search size={16} aria-hidden="true" className="shrink-0 text-muted" />
        <input
          type="search"
          value={search}
          placeholder={t("searchChats")}
          onChange={(e) => setParam("q", e.target.value)}
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      {isLoading ? (
        <StateBlock variant="loading" message="Loading your chats…" />
      ) : isError ? (
        <StateBlock
          variant="error"
          icon={MessageSquareText}
          title="Couldn’t load chats"
          message="Something went wrong fetching your conversation history."
          action={
            <AppButton variant="ghost" onClick={() => refresh()}>
              <RotateCw size={15} aria-hidden="true" />
              Retry
            </AppButton>
          }
        />
      ) : visibleChats.length === 0 ? (
        <StateBlock
          variant="empty"
          icon={MessageSquareText}
          title={conversations.length === 0 ? "No chats yet" : "No matching chats"}
          message={
            conversations.length === 0
              ? "Start a conversation in Ask and it will show up here."
              : "Try a different search term or filter."
          }
          action={
            conversations.length === 0 ? (
              <AppButton onClick={() => navigate(ROUTES.CHAT)}>
                <Plus size={16} aria-hidden="true" />
                {t("newChat")}
              </AppButton>
            ) : null
          }
        />
      ) : (
        <div className="">
          {visibleChats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              selectMode={selectMode}
              isSelected={selectedIds.has(chat.id)}
              onOpen={openChat}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {confirmOpen ? (
        <ConfirmBulkDelete
          count={selectedCount}
          isDeleting={isBulkDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default ConversationsPage;
