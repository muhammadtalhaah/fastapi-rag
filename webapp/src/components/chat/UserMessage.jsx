import { AppButton, AppTooltip } from "@/components/shared";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import LNG from "@/language";
import { Check, ChevronDown, ChevronUp, Copy, Pencil } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

// Grow the textarea with its content, from 1 row up to MAX_ROWS, then scroll.
const MAX_ROWS = 10;

// Reset to a single row, then grow to fit content up to a MAX_ROWS cap derived
// from the element's own line-height so it tracks the text styles.
const autoResize = (el) => {
  if (!el) return;
  el.style.height = "auto";
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 0;
  const maxHeight = lineHeight * MAX_ROWS;
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
};

// A user's prompt bubble (right-aligned). For authenticated users it reveals a
// Copy/Edit action row on hover or keyboard focus; guests see the bubble only.
//
// Editing swaps the bubble for an inline textarea. Saving calls `onEdit(id,
// text)`, which truncates the transcript from this turn and re-asks with the
// revised text (see useChat.editMessage). Save is suppressed while a response is
// in flight (`canEdit` false) or when the text is unchanged/empty.
// Collapsed bubbles taller than this (px) are clamped behind a fade, with a
// Show more / Show less toggle. Matches ~8 lines of the bubble's leading.
const COLLAPSED_MAX_HEIGHT = 224;

const UserMessage = memo(({ message, isAuthenticated, canEdit, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textareaRef = useRef(null);
  const bubbleRef = useRef(null);
  const { copied, copy } = useCopyToClipboard();

  // Detect whether the prompt overflows the collapsed cap so the toggle only
  // appears when there's hidden content. Re-measured if the text changes (an
  // edit can shorten a long prompt below the threshold).
  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT);
  }, [message.text]);

  // Focus and size the textarea to its content when edit mode opens, dropping
  // the caret at the end so the user can keep typing immediately.
  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autoResize(el);
  }, [isEditing]);

  const openEditor = () => {
    setDraft(message.text);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(message.text);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.text.trim()) {
      cancelEdit();
      return;
    }
    setIsEditing(false);
    onEdit(message.id, trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-3xl border border-rule bg-surface px-4 py-3 transition-colors focus-within:border-retrieval">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full resize-none !border-none bg-transparent text-sm leading-relaxed text-ink !outline-none focus:!ring-0"
            aria-label={LNG.eng.editMessage}
          />
          <div className="mt-2 flex justify-end gap-2">
            <AppButton
              variant="ghost"
              onClick={cancelEdit}
              className="!px-3 !py-1 !text-xs"
            >
              {LNG.eng.cancel}
            </AppButton>
            <AppButton
              variant="primary"
              onClick={saveEdit}
              disabled={!canEdit || !draft.trim()}
              className="!px-3 !py-1 !text-xs"
            >
              {LNG.eng.save}
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="flex max-w-[85%] flex-col items-end">
        <div className="relative w-full">
          <p
            ref={bubbleRef}
            style={
              !expanded && isOverflowing
                ? { maxHeight: COLLAPSED_MAX_HEIGHT }
                : undefined
            }
            className="overflow-hidden whitespace-pre-wrap border border-rule bg-surface p-2 text-sm leading-relaxed text-ink"
          >
            {message.text}
          </p>
          {!expanded && isOverflowing ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          ) : null}
        </div>
        {isOverflowing ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            {expanded ? LNG.eng.showLess : LNG.eng.showMore}
            {expanded ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {isAuthenticated ? (
        <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <AppTooltip title={copied ? LNG.eng.copied : LNG.eng.copyMessage}>
            <button
              type="button"
              onClick={() => copy(message.text)}
              aria-label={LNG.eng.copyMessage}
              className={`inline-flex items-center rounded-md p-1.5 transition-colors hover:bg-surface ${
                copied ? "text-brass" : "text-muted hover:text-ink"
              }`}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
          </AppTooltip>
          <AppTooltip title={LNG.eng.editMessage}>
            <button
              type="button"
              onClick={openEditor}
              disabled={!canEdit}
              aria-label={LNG.eng.editMessage}
              className="inline-flex items-center rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
          </AppTooltip>
        </div>
      ) : null}
    </div>
  );
});
UserMessage.displayName = "UserMessage";

export default UserMessage;
