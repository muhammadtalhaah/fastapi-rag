import { conversationsApi, unwrap } from "@/api";
import { toSource } from "./chatService";

let nextId = 1;
const makeId = () => `h${nextId++}`;

// Map a backend conversation-list row to the sidebar shape.
function toSummary(raw) {
  return {
    id: raw.id,
    title: raw.title || "Untitled",
    updatedAt: raw.updated_at || raw.created_at || null,
  };
}

// Map a persisted message into the exact shape the chat transcript renders.
// Assistant turns are marked "done" and their stored sources are run through the
// same toSource() mapper a live answer uses, so a reopened conversation looks
// identical to one that just streamed.
function toMessage(raw) {
  if (raw.role === "user") {
    return { id: makeId(), role: "user", text: raw.text || "" };
  }
  return {
    id: makeId(),
    role: "assistant",
    status: "done",
    text: raw.text || "",
    sources: (raw.sources || []).map(toSource),
    // Older messages predate model tracking; null hides the label gracefully.
    modelName: raw.model_name || null,
    activity: null,
  };
}

// List the current user's conversations (newest first).
export async function listConversations() {
  const data = unwrap(await conversationsApi.list());
  return (data || []).map(toSummary);
}

// Map a backend search result row to the shape the search modal renders. Each
// snippet keeps its `messageIndex` so clicking a result can scroll to and
// highlight the exact message in the reopened conversation.
function toSearchResult(raw) {
  return {
    id: raw.id,
    title: raw.title || "Untitled",
    updatedAt: raw.updated_at || null,
    titleMatch: Boolean(raw.title_match),
    snippets: (raw.snippets || []).map((s) => ({
      role: s.role,
      snippet: s.snippet || "",
      messageIndex: s.message_index,
    })),
  };
}

// Search conversation titles and message bodies. Returns relevance-ordered
// results plus pagination metadata. An AbortSignal lets the caller cancel a
// superseded request as the user keeps typing.
export async function searchConversations(
  { query, limit = 20, offset = 0 },
  { signal } = {},
) {
  const data = unwrap(
    await conversationsApi.search({ q: query, limit, offset }, { signal }),
  );
  return {
    results: (data?.results || []).map(toSearchResult),
    total: data?.total ?? 0,
    limit: data?.limit ?? limit,
    offset: data?.offset ?? offset,
    hasMore: Boolean(data?.has_more),
  };
}

// Load one conversation's full transcript as ready-to-render messages. An
// optional AbortSignal lets callers cancel a stale load when the user switches
// conversations mid-fetch.
export async function getConversation(id, { signal } = {}) {
  const data = unwrap(await conversationsApi.get(id, { signal }));
  return {
    id: data.id,
    title: data.title || "Untitled",
    messages: (data.messages || []).map(toMessage),
  };
}

// Rename a conversation and return the updated sidebar summary shape.
export async function updateConversation(id, payload) {
  const data = unwrap(await conversationsApi.update(id, payload));
  return toSummary(data);
}

// Delete a conversation.
export async function deleteConversation(id) {
  unwrap(await conversationsApi.remove(id));
}
