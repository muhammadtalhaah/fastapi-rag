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
    activity: null,
  };
}

// List the current user's conversations (newest first).
export async function listConversations() {
  const data = unwrap(await conversationsApi.list());
  return (data || []).map(toSummary);
}

// Load one conversation's full transcript as ready-to-render messages.
export async function getConversation(id) {
  const data = unwrap(await conversationsApi.get(id));
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
