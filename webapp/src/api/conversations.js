import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// HTTP layer only — durable conversation history for the logged-in user.
// Writing happens over the chat WebSocket; these are the read/manage calls.
const list = () => apiClient.get(ENDPOINTS.CONVERSATIONS);

// Full-text search across the user's conversation titles and message bodies.
// `q` is the query; `limit`/`offset` paginate. An AbortSignal cancels a stale
// in-flight request when the user keeps typing.
const search = (params, { signal } = {}) =>
  apiClient.get(ENDPOINTS.CONVERSATION_SEARCH, params, { signal });

const get = (id, { signal } = {}) =>
  apiClient.get(ENDPOINTS.conversation(id), {}, { signal });

const update = (id, payload) => apiClient.patch(ENDPOINTS.conversation(id), payload);

const remove = (id) => apiClient.delete(ENDPOINTS.conversation(id));

export default { list, search, get, update, remove };
