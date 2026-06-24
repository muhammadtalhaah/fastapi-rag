// Backend route constants. The FastAPI app mounts everything under /api/v1.
// In dev these are proxied to http://localhost:8000 (see vite.config.js).
const BASE = "/api/v1";

export const ENDPOINTS = {
  AUTH_LOGIN: `${BASE}/auth/login`,
  AUTH_LOGOUT: `${BASE}/auth/logout`,
  AUTH_ME: `${BASE}/auth/me`,
  AUTH_GOOGLE_LOGIN: `${BASE}/auth/google/login`,
  QUERY: `${BASE}/query/stream`,
  QUERY_WS: `${BASE}/query/ws`,
  querySession: (id) => `${BASE}/query/session/${id}`,
  CONVERSATIONS: `${BASE}/conversations`,
  CONVERSATION_SEARCH: `${BASE}/conversations/search`,
  conversation: (id) => `${BASE}/conversations/${id}`,
  INGEST: `${BASE}/ingest/`,
  ingestItem: (id) => `${BASE}/ingest/${id}`,
  documentDownload: (id) => `${BASE}/ingest/${id}/download`,
  document: (id) => `${BASE}/documents/${id}`,
};
