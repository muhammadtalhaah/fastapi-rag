import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search, SearchX, X } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { useConversationSearch } from "@/hooks";
import Spinner from "./Spinner";
import SearchResultItem from "./SearchResultItem";

// Centered, full-text search over the user's conversation history. Opened from
// the "Recents" header in the sidebar. Mirrors the LoginModal conventions —
// fixed overlay, hairline-ruled panel, Escape + backdrop-click to close, focus
// moved to the input on open. Closing is owned by the parent (`onClose`).
//
// Selecting a result navigates to the conversation. When a specific message
// matched, an `m=<index>` param is added so the chat page scrolls to and
// highlights that message.
const SearchModal = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const {
    query,
    setQuery,
    hasQuery,
    results,
    total,
    hasMore,
    isLoading,
    isFetchingMore,
    isError,
    loadMore,
    recentSearches,
    persistRecent,
    clearRecentSearches,
  } = useConversationSearch();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSelect = (conversationId, messageIndex) => {
    persistRecent(query);
    const params = new URLSearchParams({ c: conversationId });
    if (messageIndex != null) params.set("m", String(messageIndex));
    navigate(`${ROUTES.CHAT}?${params.toString()}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ground/80 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-xl flex-col border border-rule bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
          <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your conversations…"
            aria-label="Search conversations"
            id="search-title"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {isLoading ? <Spinner size={16} /> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 text-muted transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasQuery ? (
            <RecentSearches
              recentSearches={recentSearches}
              onPick={setQuery}
              onClear={clearRecentSearches}
            />
          ) : isError ? (
            <p className="px-4 py-10 text-center text-sm text-danger">
              Search failed. Try again.
            </p>
          ) : isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <SearchX size={28} strokeWidth={1.5} aria-hidden="true" className="text-rule" />
              <p className="text-sm text-muted">
                No results found for <span className="text-ink">“{query}”</span>
              </p>
            </div>
          ) : (
            <>
              <p className="px-4 pb-1 pt-3 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-muted">
                {total} {total === 1 ? "conversation" : "conversations"}
              </p>
              <ul>
                {results.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    query={query}
                    onSelect={handleSelect}
                  />
                ))}
              </ul>
              {hasMore ? (
                <div className="flex justify-center px-4 py-3">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isFetchingMore}
                    className="border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-ink disabled:opacity-50"
                  >
                    {isFetchingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Empty-state body: recent searches (if any) or a helpful placeholder.
const RecentSearches = ({ recentSearches, onPick, onClear }) => {
  if (recentSearches.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted">
        Search across your conversation titles and messages.
      </p>
    );
  }
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-muted">
          Recent searches
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[0.65rem] text-muted transition-colors hover:text-ink"
        >
          Clear
        </button>
      </div>
      <ul>
        {recentSearches.map((term) => (
          <li key={term}>
            <button
              type="button"
              onClick={() => onPick(term)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-muted transition-colors hover:bg-ground/60 hover:text-ink"
            >
              <Clock size={14} aria-hidden="true" className="shrink-0 text-rule" />
              <span className="truncate">{term}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchModal;
