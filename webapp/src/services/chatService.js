import { ENDPOINTS } from "@/api/endpoints";

let sharedWs = null;
let connectPromise = null;
let activeHandlers = null;
let activeRequestId = 0;

const MAX_CONNECTION_RETRIES = 5;
const RETRY_DELAY_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Best-effort: tell the backend to drop a conversation (e.g. on "New chat").
// Fire-and-forget — a failed eviction just means the session lingers until the
// server restarts, which is harmless for ephemeral unauth sessions.
export function endSession(sessionId) {
  if (!sessionId) return;
  const base = import.meta.env.VITE_API_BASE_URL || "";
  fetch(`${base}${ENDPOINTS.querySession(sessionId)}`, { method: "DELETE" }).catch(
    () => {},
  );
}

export function toSource(raw, index) {
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

function buildWsUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  // If base is an absolute http(s) URL, swap scheme to ws(s).
  if (base.startsWith("http")) {
    return base.replace(/^http/, "ws") + path;
  }
  // Relative base (dev proxy) — use current host.
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${base}${path}`;
}

function setSocketHandlers(ws) {
  ws.onmessage = (evt) => {
    if (!activeHandlers) return;
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    const { event, data } = msg;
    if (event === "session") activeHandlers.onSession?.(data.session_id);
    else if (event === "conversation")
      activeHandlers.onConversation?.(data.conversation_id);
    else if (event === "conversation_title")
      activeHandlers.onConversationTitle?.(data.text || "");
    else if (event === "status") activeHandlers.onStatus?.(data.stage, data.message);
    else if (event === "sources")
      activeHandlers.onSources?.((data.sources || []).map(toSource));
    else if (event === "token") activeHandlers.onToken?.(data.text);
    else if (event === "done") {
      const handlers = activeHandlers;
      activeHandlers = null;
      handlers.onDone?.();
      handlers.resolve?.();
    } else if (event === "error") {
      const handlers = activeHandlers;
      activeHandlers = null;
      handlers.onError?.(data.message || "Unknown error.");
      handlers.resolve?.();
    }
  };

  ws.onclose = () => {
    sharedWs = null;
    connectPromise = null;
    if (activeHandlers) {
      const handlers = activeHandlers;
      activeHandlers = null;
      handlers.onError?.("Connection closed unexpectedly.");
      handlers.resolve?.();
    }
  };

  ws.onerror = () => {
    if (activeHandlers) {
      activeHandlers.onError?.(
        "WebSocket connection error — check that the backend is running.",
      );
    }
  };
}

export function ensureChatSocket() {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    return Promise.resolve(sharedWs);
  }
  if (connectPromise) {
    return connectPromise;
  }

  const openSocket = () =>
    new Promise((resolve, reject) => {
      let ws;
      try {
        ws = new WebSocket(buildWsUrl(ENDPOINTS.QUERY_WS));
      } catch (err) {
        reject(err);
        return;
      }

      ws.onopen = () => {
        sharedWs = ws;
        setSocketHandlers(ws);
        resolve(ws);
      };

      ws.onerror = () => {
        ws.close();
        reject(new Error("Failed to open WebSocket connection."));
      };

      ws.onclose = () => {
        if (sharedWs === ws) {
          sharedWs = null;
        }
      };
    });

  connectPromise = (async () => {
    try {
      return await openSocket();
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

// Stream a question to the backend WebSocket endpoint.
// `sessionId` ties this turn to the server-side LLM *context* (summary + recent
// window). `conversationId` ties it to the logged-in user's DURABLE history
// thread — pass null to start a new thread; the backend mints one and returns it
// via onConversation (logged-in users only; guests never get a conversation id).
// Callbacks:
//   onSession(sessionId)           — server's context session id (next turn)
//   onConversation(conversationId) — durable history id (logged-in users only)
//   onConversationTitle(title)     — incremental sidebar title for new chats
//   onStatus(stage, message)       — activity indicator
//   onSources(sources)             — source chunks before generation
//   onToken(text)                  — incremental answer token
//   onDone()                       — stream complete
//   onError(message)               — server or network error
export function askStream(
  question,
  topK,
  sessionId,
  conversationId,
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
    const connectWithRetry = async () => {
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_CONNECTION_RETRIES; attempt += 1) {
        onStatus?.(
          "connecting",
          attempt === 1
            ? "Connecting to the chat service..."
            : `Retrying connection (${attempt}/${MAX_CONNECTION_RETRIES})...`,
        );

        try {
          const socket = await ensureChatSocket();
          return socket;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_CONNECTION_RETRIES) {
            onStatus?.(
              "retrying",
              `Connection failed. Retrying in ${Math.ceil(RETRY_DELAY_MS / 1000)} second${RETRY_DELAY_MS >= 2000 ? "s" : ""} (${attempt}/${MAX_CONNECTION_RETRIES})...`,
            );
            await delay(RETRY_DELAY_MS);
          }
        }
      }

      throw lastError || new Error("Failed to open WebSocket connection.");
    };

    connectWithRetry()
      .then((ws) => {
        if (activeHandlers) {
          onError?.("A response is already in progress. Please wait for it to finish.");
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
          }),
        );
      })
      .catch((err) => {
        onError?.(err.message || "Failed to open WebSocket connection.");
        resolve();
      });
  });
}
