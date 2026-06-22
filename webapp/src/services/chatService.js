import { ENDPOINTS } from "@/api/endpoints";

// Best-effort: tell the backend to drop a conversation (e.g. on "New chat").
// Fire-and-forget — a failed eviction just means the session lingers until the
// server restarts, which is harmless for ephemeral unauth sessions.
export function endSession(sessionId) {
  if (!sessionId) return;
  const base = import.meta.env.VITE_API_BASE_URL || "";
  fetch(`${base}${ENDPOINTS.querySession(sessionId)}`, { method: "DELETE" }).catch(() => {});
}

function toSource(raw, index) {
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

// Stream a question to the backend WebSocket endpoint.
// `sessionId` ties this turn to a server-side conversation so the bot answers
// follow-ups in context. Pass null to start a fresh conversation — the backend
// mints an id and returns it via the onSession callback.
// Callbacks:
//   onSession(sessionId)      — server's session id (capture for next turn)
//   onStatus(stage, message)  — activity indicator
//   onSources(sources)        — source chunks before generation
//   onToken(text)             — incremental answer token
//   onDone()                  — stream complete
//   onError(message)          — server or network error
export function askStream(question, topK, sessionId, { onSession, onStatus, onSources, onToken, onDone, onError }) {
  return new Promise((resolve) => {
    let ws;
    let finished = false;

    const finish = (fn) => {
      if (finished) return;
      finished = true;
      fn?.();
      resolve();
    };

    try {
      ws = new WebSocket(buildWsUrl(ENDPOINTS.QUERY_WS));
    } catch (err) {
      finish(() => onError?.(err.message || "Failed to open WebSocket connection."));
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ question, top_k: topK, session_id: sessionId || null }));
    };

    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      const { event, data } = msg;
      if (event === "session") onSession?.(data.session_id);
      else if (event === "status") onStatus?.(data.stage, data.message);
      else if (event === "sources") onSources?.((data.sources || []).map(toSource));
      else if (event === "token") onToken?.(data.text);
      else if (event === "done") { finish(() => { onDone?.(); ws.close(); }); }
      else if (event === "error") { finish(() => { onError?.(data.message || "Unknown error."); ws.close(); }); }
    };

    ws.onerror = () => {
      finish(() => onError?.("WebSocket connection error — check that the backend is running."));
    };

    ws.onclose = (evt) => {
      if (!evt.wasClean) {
        finish(() => onError?.("Connection closed unexpectedly."));
      } else {
        finish(null);
      }
    };
  });
}
