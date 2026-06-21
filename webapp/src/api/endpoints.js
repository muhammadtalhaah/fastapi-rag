// Backend route constants. The FastAPI app mounts everything under /api/v1.
// In dev these are proxied to http://localhost:8000 (see vite.config.js).
const BASE = "/api/v1";

export const ENDPOINTS = {
  QUERY: `${BASE}/query/stream`,
  INGEST: `${BASE}/ingest/`,
  ingestItem: (id) => `${BASE}/ingest/${id}`,
  documentDownload: (id) => `${BASE}/ingest/${id}/download`,
  document: (id) => `${BASE}/documents/${id}`,
};
