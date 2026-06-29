import { Check, Pin } from "lucide-react";
import { formatDate } from "@/utils/format";

// One row in the Chats manager list. Two modes:
//   - browse: clicking the row opens the conversation.
//   - select: a leading checkbox toggles the row; clicking anywhere on the row
//     toggles selection instead of navigating, so the whole row is a hit target.
// A pinned chat shows a brass pin marker, mirroring the sidebar Recents.
const ChatRow = ({ chat, selectMode, isSelected, onOpen, onToggleSelect }) => {
  const handleClick = () => {
    if (selectMode) onToggleSelect(chat.id);
    else onOpen(chat.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group flex cursor-pointer items-center gap-3 border-b border-rule px-4 py-3 transition-colors last:border-b-0 ${
        isSelected ? "bg-ground" : "hover:bg-surface/60"
      }`}
    >
      {selectMode ? (
        <span
          aria-hidden="true"
          className={`grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
            isSelected ? "border-brass bg-brass text-ground" : "border-rule"
          }`}
        >
          {isSelected ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2" title={chat.title}>
        {chat.pinned ? (
          <Pin size={13} className="shrink-0 text-brass" aria-label="Pinned" />
        ) : null}
        <span className="truncate text-sm text-ink">{chat.title}</span>
      </div>

      <span className="shrink-0 font-mono text-xs text-muted">
        {formatDate(chat.updatedAt)}
      </span>
    </div>
  );
};

export default ChatRow;
