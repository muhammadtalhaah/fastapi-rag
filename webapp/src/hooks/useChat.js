import { useCallback, useRef, useState } from "react";
import { askStream, endSession } from "@/services/chatService";
import { DEFAULT_TOP_K } from "@/config";

let nextId = 1;
const makeId = () => `m${nextId++}`;

// Owns the conversation transcript for display. Conversational *context* is held
// server-side, keyed by a session id the backend returns on the first turn — the
// client only carries that id, never the full history. The id lives in component
// state, so a page refresh (remount) starts a brand-new conversation; `newChat`
// does the same on demand and evicts the old session server-side.
//
// Each assistant message goes through these statuses:
//   "pending"    — waiting for first byte
//   "streaming"  — tokens are arriving (text is built incrementally)
//   "done"       — complete
//   "error"      — failed
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  // The server-side conversation id. Held in a ref so `send` reads the latest
  // value without re-creating the callback; mirrored to state is unnecessary
  // since nothing renders it.
  const sessionIdRef = useRef(null);

  const send = useCallback(async (question) => {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    const userMessage = { id: makeId(), role: "user", text: trimmed };
    const pendingId = makeId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: pendingId, role: "assistant", status: "pending", text: "", sources: [], activity: null },
    ]);
    setIsAsking(true);

    const patch = (fields) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, ...fields } : m))
      );

    await askStream(trimmed, DEFAULT_TOP_K, sessionIdRef.current, {
      onSession: (sessionId) => {
        sessionIdRef.current = sessionId;
      },
      onStatus: (stage, message) => {
        patch({ status: "streaming", activity: message });
      },
      onSources: (sources) => {
        patch({ sources });
      },
      onToken: (text) => {
        patch({ status: "streaming", activity: null });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, status: "streaming", activity: null, text: m.text + text } : m
          )
        );
      },
      onDone: () => {
        patch({ status: "done", activity: null });
        setIsAsking(false);
      },
      onError: (message) => {
        patch({ status: "error", error: message, activity: null });
        setIsAsking(false);
      },
    });
  }, [isAsking]);

  const retry = useCallback(
    (failedId) => {
      const index = messages.findIndex((m) => m.id === failedId);
      const userTurn = messages[index - 1];
      const question = userTurn?.text;
      if (!question) return;
      // The backend only records a turn on success, so a failed turn left the
      // session untouched — drop the failed exchange from the view and re-ask
      // against the same session.
      setMessages((prev) =>
        prev.filter((m) => m.id !== failedId && m.id !== userTurn.id),
      );
      send(question);
    },
    [messages, send],
  );

  // Close the current conversation and start fresh. Evicts the server session
  // and clears the transcript; the next `send` mints a new session.
  const newChat = useCallback(() => {
    endSession(sessionIdRef.current);
    sessionIdRef.current = null;
    setMessages([]);
    setIsAsking(false);
  }, []);

  return { messages, isAsking, send, retry, newChat };
}
