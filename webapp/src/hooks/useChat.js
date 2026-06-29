import { useCallback, useEffect, useRef, useState } from "react";
import { askStream, endSession, onSocketState } from "@/services/chatService";
import { getConversation } from "@/services/conversationService";
import { DEFAULT_TOP_K, DEFAULT_WEB_SEARCH } from "@/config";

let nextId = 1;
const makeId = () => `m${nextId++}`;

// Persisted web-search preference. The toggle is a user preference (like theme),
// so it survives refreshes and seeds the default for new chats. Read/write are
// best-effort: storage may be unavailable (privacy mode / SSR).
const WEB_SEARCH_STORAGE_KEY = "athenaeum-web-search";

const readWebSearchPref = () => {
  if (typeof window === "undefined") return DEFAULT_WEB_SEARCH;
  try {
    const saved = window.localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
    return DEFAULT_WEB_SEARCH;
  } catch {
    return DEFAULT_WEB_SEARCH;
  }
};

const persistWebSearchPref = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEB_SEARCH_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Persistence is best-effort; ignore storage failures.
  }
};

// Owns the conversation transcript for display. Two server-side ids are tracked:
//
//   sessionIdRef       — the in-memory LLM *context* id (rolling summary + recent
//                        window) used to answer follow-ups in context.
//   conversationIdRef  — the DURABLE history id for logged-in users; the backend
//                        mints it on the first turn and we send it back on each
//                        subsequent turn so they append to the same DB thread.
//                        Stays null for guests (no persistence).
//
// `onTurnComplete` is called after each successful turn so the caller can refresh
// the sidebar history list (a new conversation should appear immediately).
//
// Each assistant message goes through these statuses:
//   "pending"    — waiting for first byte
//   "streaming"  — tokens are arriving (text is built incrementally)
//   "done"       — complete
//   "error"      — failed
//
// `socketState` mirrors the chatService singleton: "DISCONNECTED" | "CONNECTING" | "OPEN"
// The composer is disabled while socketState !== "OPEN" or isAsking is true.
export function useChat({
  onTurnComplete,
  onConversationStart,
  onConversationTitle,
  onConversationUnavailable,
  onConversationIdReady,
} = {}) {
  const [messages, setMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [socketState, setSocketState] = useState("CONNECTING");
  const [activeConversationId, setActiveConversationId] = useState(null);
  // Web search toggle, persisted as a user preference so it survives page
  // refreshes and seeds the default for new chats. A ref mirrors it so `send`
  // reads the latest value without re-creating the callback each toggle.
  const [webSearch, setWebSearchState] = useState(readWebSearchPref);
  const webSearchRef = useRef(webSearch);
  const sessionIdRef = useRef(null);
  const conversationIdRef = useRef(null);
  const loadAbortRef = useRef(null);

  const setWebSearch = useCallback((next) => {
    webSearchRef.current = next;
    setWebSearchState(next);
    persistWebSearchPref(next);
  }, []);

  // Subscribe to the persistent socket's state changes.
  useEffect(() => {
    return onSocketState(setSocketState);
  }, []);

  const send = useCallback(async (question) => {
    const trimmed = question.trim();
    if (!trimmed || isAsking || socketState !== "OPEN") return;

    const userMessage = { id: makeId(), role: "user", text: trimmed };
    const pendingId = makeId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: pendingId, role: "assistant", status: "pending", text: "", sources: [], activity: null, modelName: null },
    ]);
    setIsAsking(true);

    const patch = (fields) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, ...fields } : m))
      );

    await askStream(trimmed, DEFAULT_TOP_K, sessionIdRef.current, conversationIdRef.current, webSearchRef.current, {
      onSession: (sessionId) => {
        sessionIdRef.current = sessionId;
      },
      onConversation: (conversationId) => {
        const isNewConversation = !conversationIdRef.current;
        conversationIdRef.current = conversationId;
        onConversationIdReady?.(conversationId);
        setActiveConversationId(conversationId);
        if (isNewConversation) {
          onConversationStart?.(conversationId, trimmed);
          onTurnComplete?.();
        }
      },
      onConversationTitle: (title) => {
        if (conversationIdRef.current) {
          onConversationTitle?.(conversationIdRef.current, title);
        }
      },
      onStatus: (_stage, message) => {
        patch({ status: "pending", activity: message });
      },
      onSources: (sources) => {
        patch({ sources });
      },
      onModel: (modelName) => {
        patch({ modelName });
      },
      onToken: (text) => {
        // Keep `activity` (the last status line, e.g. "Generating answer…")
        // visible while tokens stream so it stays above the message; it's
        // cleared on done/error.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, status: "streaming", text: m.text + text }
              : m
          )
        );
      },
      onDone: () => {
        patch({ status: "done", activity: null });
        setIsAsking(false);
        onTurnComplete?.();
      },
      onError: (message) => {
        patch({ status: "error", error: message, activity: null });
        setIsAsking(false);
      },
    });
  }, [isAsking, socketState, onConversationIdReady, onConversationStart, onConversationTitle, onTurnComplete]);

  const retry = useCallback(
    (failedId) => {
      const index = messages.findIndex((m) => m.id === failedId);
      const userTurn = messages[index - 1];
      const question = userTurn?.text;
      if (!question) return;
      setMessages((prev) =>
        prev.filter((m) => m.id !== failedId && m.id !== userTurn.id),
      );
      send(question);
    },
    [messages, send],
  );

  const newChat = useCallback(() => {
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    endSession(sessionIdRef.current);
    sessionIdRef.current = null;
    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsAsking(false);
    // Keep the user's persisted web-search preference across new chats rather
    // than resetting to the hard default.
    const pref = readWebSearchPref();
    webSearchRef.current = pref;
    setWebSearchState(pref);
  }, []);

  const loadConversation = useCallback(async (conversationId) => {
    if (!conversationId || isAsking) return;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setIsLoadingConversation(true);
    try {
      const convo = await getConversation(conversationId, {
        signal: controller.signal,
      });
      sessionIdRef.current = null;
      conversationIdRef.current = convo.id;
      setActiveConversationId(convo.id);
      setMessages(convo.messages);
      setIsAsking(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      // Any load failure (not-found / unauthorized 404·401, or a server error
      // like 502) is unrecoverable on this route: clear state and let the page
      // bounce the user back to the index with a toast, rather than stranding
      // them on a dead conversation with an inline error block.
      sessionIdRef.current = null;
      conversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
      onConversationUnavailable?.(conversationId, error?.status);
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
        setIsLoadingConversation(false);
      }
    }
  }, [isAsking, onConversationUnavailable]);

  return {
    messages,
    isAsking,
    isLoadingConversation,
    socketState,
    activeConversationId,
    webSearch,
    setWebSearch,
    send,
    retry,
    newChat,
    loadConversation,
  };
}
