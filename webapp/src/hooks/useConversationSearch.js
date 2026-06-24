import { useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { conversationService } from "@/services";
import { useAuth } from "@/context";
import {
  RECENT_SEARCHES_MAX,
  SEARCH_DEBOUNCE_MS,
  SEARCH_PAGE_SIZE,
} from "@/config";
import { useDebounce } from "./useDebounce";

const RECENT_SEARCHES_KEY = "athenaeum.recentSearches";

function readRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_SEARCHES_MAX) : [];
  } catch {
    return [];
  }
}

// Owns conversation-history search state for the search modal: the live query,
// its debounced value, paginated results, and a small list of recent searches
// persisted in localStorage.
//
// Paging uses a cumulative fetch — "load more" grows the requested `limit` and
// re-queries from offset 0 — rather than appending pages client-side. The
// backend returns a stable, relevance-ordered set, so one query per page-count
// yields the full list with no manual merging, and `keepPreviousData` keeps the
// current results on screen (no flash to empty) while typing or loading more.
export function useConversationSearch() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  // Number of pages requested; the fetch asks for pageCount * PAGE_SIZE results.
  const [pageCount, setPageCount] = useState(1);
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);

  const hasQuery = debouncedQuery.length > 0;
  const limit = pageCount * SEARCH_PAGE_SIZE;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["conversationSearch", debouncedQuery, limit],
    queryFn: ({ signal }) =>
      conversationService.searchConversations(
        { query: debouncedQuery, limit, offset: 0 },
        { signal },
      ),
    enabled: isAuthenticated && hasQuery,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // A new query (after debounce) restarts at one page. Reset during render via a
  // tracked-previous-value guard — the React-sanctioned alternative to a
  // setState-in-effect. setState during render of the SAME component is allowed
  // and is applied before children render.
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setPageCount(1);
  }

  const updateRecents = useCallback((updater) => {
    setRecentSearches((prev) => {
      const next = updater(prev);
      try {
        if (next.length) {
          window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(RECENT_SEARCHES_KEY);
        }
      } catch {
        /* storage unavailable (private mode / quota) — recents are best-effort */
      }
      return next;
    });
  }, []);

  const persistRecent = useCallback(
    (term) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      updateRecents((prev) =>
        [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, RECENT_SEARCHES_MAX),
      );
    },
    [updateRecents],
  );

  const clearRecentSearches = useCallback(() => updateRecents(() => []), [updateRecents]);

  const loadMore = useCallback(() => {
    if (data?.hasMore && !isFetching) setPageCount((p) => p + 1);
  }, [data?.hasMore, isFetching]);

  return {
    query,
    setQuery,
    debouncedQuery,
    hasQuery,
    results: data?.results ?? [],
    total: data?.total ?? 0,
    hasMore: Boolean(data?.hasMore),
    // First load of a query shows the loading state; a keep-previous refetch does not.
    isLoading: hasQuery && isLoading,
    // Fetching additional pages (pageCount grew) while previous results stay visible.
    isFetchingMore: pageCount > 1 && isFetching,
    isError,
    loadMore,
    recentSearches,
    persistRecent,
    clearRecentSearches,
  };
}
