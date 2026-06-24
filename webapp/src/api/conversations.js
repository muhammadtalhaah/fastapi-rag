import apiClient from "./client";
import { ENDPOINTS } from "./endpoints";

// HTTP layer only — durable conversation history for the logged-in user.
// Writing happens over the chat WebSocket; these are the read/manage calls.
const list = () => apiClient.get(ENDPOINTS.CONVERSATIONS);

const get = (id) => apiClient.get(ENDPOINTS.conversation(id));

const update = (id, payload) => apiClient.patch(ENDPOINTS.conversation(id), payload);

const remove = (id) => apiClient.delete(ENDPOINTS.conversation(id));

export default { list, get, update, remove };
