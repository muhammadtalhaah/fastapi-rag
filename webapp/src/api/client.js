import { create } from "apisauce";

// Centralized APISauce instance. Base URL is empty so requests hit the same
// origin and are proxied to the backend in dev; set VITE_API_BASE_URL to point
// at a deployed backend in production.
const apiClient = create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 60000, // RAG queries can take a while (embedding + LLM round-trip)
  headers: { Accept: "application/json" },
  // Auth is session-cookie based (HttpOnly session id + a readable CSRF cookie).
  // withCredentials makes the browser send/receive those cookies, including
  // cross-origin (the backend sets allow_credentials=True in CORS).
  withCredentials: true,
});

// The backend sets a readable (non-HttpOnly) CSRF cookie on login and validates
// it against the session for state-changing requests (synchronizer-token
// pattern). We echo it back in a header on those requests.
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const STATE_CHANGING = new Set(["post", "put", "patch", "delete"]);

function readCsrfToken() {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// Attach the CSRF header on state-changing requests only — safe methods are
// exempt server-side, and there's no token to send before the user logs in.
apiClient.addRequestTransform((request) => {
  if (STATE_CHANGING.has((request.method || "").toLowerCase())) {
    const token = readCsrfToken();
    if (token) request.headers[CSRF_HEADER_NAME] = token;
  }
});

// Readable fallbacks for APISauce problem codes, which are machine strings
// like "NETWORK_ERROR" and must never be shown to a person verbatim.
const PROBLEM_MESSAGES = {
  NETWORK_ERROR: "Can’t reach the server. Check that the backend is running.",
  TIMEOUT_ERROR: "The request took too long. Try again.",
  CONNECTION_ERROR: "Can’t reach the server. Check your connection.",
  SERVER_ERROR: "The server ran into a problem. Try again in a moment.",
  CLIENT_ERROR: "That request couldn’t be completed.",
  CANCEL_ERROR: "The request was cancelled.",
};

// Normalize APISauce responses into a thrown Error on failure, or data on success.
// FastAPI sends human-readable messages in `detail`; fall back to a friendly
// problem-code message before any generic catch-all.
export function unwrap(response) {
  if (response.ok) return response.data;

  const detail = response.data?.detail;
  const message =
    (typeof detail === "string" && detail) ||
    (Array.isArray(detail) && detail[0]?.msg) ||
    PROBLEM_MESSAGES[response.problem] ||
    "Something went wrong. Please try again.";

  const error = new Error(message);
  error.status = response.status;
  throw error;
}

export default apiClient;
