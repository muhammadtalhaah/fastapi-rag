// Default number of source chunks to retrieve per query (backend allows 1–20).
export const DEFAULT_TOP_K = 5;

// File types the backend ingest endpoint accepts.
export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

// Conversation history search: how long to wait after the user stops typing
// before firing a request, and how many results to fetch per page.
export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_PAGE_SIZE = 20;
// Cap on locally-remembered recent searches shown when the input is empty.
export const RECENT_SEARCHES_MAX = 5;
