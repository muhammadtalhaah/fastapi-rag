import { ENDPOINTS } from "@/api/endpoints";

// ---------------------------------------------------------------------------
// Persistent WebSocket — opened once on app start, kept alive forever.
//
// State machine:
//   DISCONNECTED -> CONNECTING -> OPEN -> DISCONNECTED (on close/error)
//   Automatic exponential-backoff reconnect from DISCONNECTED.
//
// Only one turn may be in flight at a time (the backend processes one message
// per connection sequentially). If the socket drops mid-turn the in-flight
// handlers receive an error and the socket is immediately re-queued.
// ---------------------------------------------------------------------------

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_FACTOR = 2;

// Module-level singleton state
let ws = null;
let wsState = "DISCONNECTED"; // "DISCONNECTED" | "CONNECTING" | "OPEN"
let reconnectTimer = null;
let backoffMs = INITIAL_BACKOFF_MS;
let activeHandlers = null; // non-null while a turn is in flight
let activeRequestId = 0;

// External listeners notified on connection-state changes so the UI can react.
const stateListeners = new Set();

function notifyState() {
  stateListeners.forEach((fn) => fn(wsState));
}

export function onSocketState(fn) {
  stateListeners.add(fn);
  fn(wsState); // deliver current state immediately
  return () => stateListeners.delete(fn);
}

export function getSocketState() {
  return wsState;
}

function buildWsUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  if (base.startsWith("http")) {
    return base.replace(/^http/, "ws") + path;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${base}${path}`;
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * BACKOFF_FACTOR, MAX_BACKOFF_MS);
}

function connect() {
  if (wsState === "CONNECTING" || wsState === "OPEN") return;
  wsState = "CONNECTING";
  notifyState();

  let socket;
  try {
    socket = new WebSocket(buildWsUrl(ENDPOINTS.QUERY_WS));
  } catch {
    wsState = "DISCONNECTED";
    notifyState();
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    ws = socket;
    wsState = "OPEN";
    backoffMs = INITIAL_BACKOFF_MS; // reset backoff on successful connect
    notifyState();
  };

  socket.onmessage = (evt) => {
    if (!activeHandlers) return;
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    const { event, data } = msg;
    if (event === "session") activeHandlers.onSession?.(data.session_id);
    else if (event === "conversation") activeHandlers.onConversation?.(data.conversation_id);
    else if (event === "conversation_title") activeHandlers.onConversationTitle?.(data.text || "");
    else if (event === "status") activeHandlers.onStatus?.(data.stage, data.message);
    else if (event === "sources") activeHandlers.onSources?.((data.sources || []).map(toSource));
    else if (event === "model") activeHandlers.onModel?.(data.name || "");
    else if (event === "token") activeHandlers.onToken?.(data.text);
    else if (event === "done") {
      const h = activeHandlers;
      activeHandlers = null;
      h.onDone?.();
      h.resolve?.();
    } else if (event === "error") {
      const h = activeHandlers;
      activeHandlers = null;
      h.onError?.(data.message || "Unknown error.");
      h.resolve?.();
    }
  };

  socket.onclose = () => {
    if (ws === socket) ws = null;
    wsState = "DISCONNECTED";
    notifyState();
    // If a turn was in flight, surface the error before reconnecting.
    if (activeHandlers) {
      const h = activeHandlers;
      activeHandlers = null;
      h.onError?.("Connection lost. Please try again.");
      h.resolve?.();
    }
    scheduleReconnect();
  };

  socket.onerror = () => {
    // onclose fires right after onerror — let it handle cleanup.
  };
}

// Start the persistent connection immediately when this module is imported.
connect();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function endSession(sessionId) {
  if (!sessionId) return;
  const base = import.meta.env.VITE_API_BASE_URL || "";
  fetch(`${base}${ENDPOINTS.querySession(sessionId)}`, { method: "DELETE" }).catch(() => {});
}

export function toSource(raw, index) {
  if (raw.type === "web") {
    return {
      key: `web-${raw.url}-${index}`,
      type: "web",
      title: raw.title,
      url: raw.url,
      snippet: raw.snippet,
    };
  }
  return {
    key: `${raw.document_id}-${raw.chunk_index}-${index}`,
    documentId: raw.document_id,
    filename: raw.filename,
    chunkIndex: raw.chunk_index,
    text: raw.text,
    score: raw.score,
    callNumber: deriveCallNumber(raw.filename, raw.chunk_index),
  };
}

function deriveCallNumber(filename, chunkIndex) {
  const stem = (filename || "DOC").replace(/\.[^.]+$/, "");
  const code = stem.slice(0, 3).toUpperCase().padEnd(3, "X");
  return `${code}·${String(chunkIndex).padStart(3, "0")}`;
}

// Send a question over the persistent socket. If the socket is not yet OPEN,
// waits up to the given timeout then surfaces an error — it does NOT reconnect
// here; the background reconnect loop handles that.
export function askStream(
  question,
  topK,
  sessionId,
  conversationId,
  webSearch,
  {
    onSession,
    onConversation,
    onConversationTitle,
    onStatus,
    onSources,
    onToken,
    onDone,
    onError,
  },
) {
  return new Promise((resolve) => {
    if (activeHandlers) {
      onError?.("A response is already in progress. Please wait for it to finish.");
      resolve();
      return;
    }

    if (wsState !== "OPEN") {
      onError?.("Not connected to the chat service. Reconnecting — please try again in a moment.");
      resolve();
      return;
    }

    activeRequestId += 1;
    activeHandlers = {
      requestId: activeRequestId,
      onSession,
      onConversation,
      onConversationTitle,
      onStatus,
      onSources,
      onToken,
      onDone,
      onError,
      resolve,
    };

    ws.send(
      JSON.stringify({
        question,
        top_k: topK,
        session_id: sessionId || null,
        conversation_id: conversationId || null,
        // Defaults to true on the backend if omitted; sent explicitly so the
        // user's per-conversation toggle is honored.
        web_search: webSearch !== false,
      }),
    );
  });
}
