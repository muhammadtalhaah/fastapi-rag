// Default number of source chunks to retrieve per query (backend allows 1–20).
export const DEFAULT_TOP_K = 5;

// Display name of the active AI model, shown in the composer. The backend uses
// a single fixed deployment today, so this is the one source of truth for the
// label — swap it here (or wire it to an API) if a model picker is added.
export const MODEL_NAME = "GPT-5.4";

// Selectable models surfaced in the composer's model dropdown. Only one entry
// today (the backend has a single fixed deployment), but the picker is built to
// list any number — add entries here when more models become switchable.
export const MODELS = [{ id: "gpt-5.4", name: MODEL_NAME }];

// Which model is active by default (must match an id in MODELS).
export const DEFAULT_MODEL_ID = MODELS[0].id;

// Web search is on by default for new chats. When enabled, the assistant may
// search the web for current information; when off, it answers only from
// uploaded documents and the model's built-in knowledge.
export const DEFAULT_WEB_SEARCH = true;

// File types the backend ingest endpoint accepts.
export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

// Conversation history search: how long to wait after the user stops typing
// before firing a request, and how many results to fetch per page.
export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_PAGE_SIZE = 20;
// Cap on locally-remembered recent searches shown when the input is empty.
export const RECENT_SEARCHES_MAX = 5;
