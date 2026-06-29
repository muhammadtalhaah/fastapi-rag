import { useCallback, useEffect, useRef, useState } from "react";
import { askStream, endSession, onSocketState, stopStream } from "@/services/chatService";
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
  // The id of the assistant message currently streaming, and whether the user
  // stopped it. `stop` reads these to decide how to settle the partial turn.
  const pendingIdRef = useRef(null);
  const stoppedRef = useRef(false);

  const setWebSearch = useCallback((next) => {
    webSearchRef.current = next;
    setWebSearchState(next);
    persistWebSearchPref(next);
  }, []);

  // Subscribe to the persistent socket's state changes.
  useEffect(() => {
    return onSocketState(setSocketState);
  }, []);

  // Send a question. Normally (regenerateId omitted) this appends a new user
  // turn plus a pending assistant turn. When `regenerateId` is the id of an
  // existing assistant message, NO new turns are added: the answer streams into
  // that same message as a fresh *version*, and the in-place turn becomes the
  // active one in its < n/m > carousel. The backend is told `regenerate: true`
  // so it replaces the last assistant turn in durable history instead of
  // appending a duplicate exchange.
  const send = useCallback(async (question, { regenerateId = null } = {}) => {
    const trimmed = question.trim();
    if (!trimmed || isAsking || socketState !== "OPEN") return;

    const isRegenerate = Boolean(regenerateId);
    const pendingId = isRegenerate ? regenerateId : makeId();

    if (isRegenerate) {
      // Reset the targeted message to a pending state for the new version while
      // keeping its existing versions; a fresh version is committed on done.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, status: "pending", text: "", sources: [], activity: null, modelName: null }
            : m,
        ),
      );
    } else {
      const userMessage = { id: makeId(), role: "user", text: trimmed };
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: pendingId,
          role: "assistant",
          status: "pending",
          text: "",
          sources: [],
          activity: null,
          modelName: null,
          versions: [],
          activeVersion: 0,
        },
      ]);
    }
    setIsAsking(true);
    pendingIdRef.current = pendingId;
    stoppedRef.current = false;

    const patch = (fields) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, ...fields } : m))
      );

    await askStream(trimmed, DEFAULT_TOP_K, sessionIdRef.current, conversationIdRef.current, webSearchRef.current, isRegenerate, {
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
        // Commit the streamed answer as a new version of this turn and make it
        // the active one. The top-level text/sources/modelName already hold the
        // freshly streamed content, so the new version snapshots them; the
        // < n/m > carousel reads from `versions`/`activeVersion`.
        //
        // This path also settles a user-stopped turn (the socket close routes
        // through onDone): whatever streamed so far is preserved. The one
        // exception is stopping before any token arrived — committing an empty
        // version is useless, so we drop a fresh assistant turn (and its user
        // turn) entirely, or restore a regenerate to its prior version.
        const wasStopped = stoppedRef.current;
        setMessages((prev) => {
          if (wasStopped) {
            const target = prev.find((m) => m.id === pendingId);
            const hasPartial = Boolean(target?.text);
            if (!hasPartial) {
              if (isRegenerate && target?.versions?.length) {
                const last = target.versions.length - 1;
                const v = target.versions[last];
                return prev.map((m) =>
                  m.id === pendingId
                    ? { ...m, status: "done", activity: null, text: v.text, sources: v.sources, modelName: v.modelName, activeVersion: last }
                    : m,
                );
              }
              // Fresh turn stopped before any text: drop the empty assistant
              // turn and the user turn that prompted it.
              const idx = prev.findIndex((m) => m.id === pendingId);
              const dropIds = new Set([pendingId]);
              if (idx > 0 && prev[idx - 1]?.role === "user") dropIds.add(prev[idx - 1].id);
              return prev.filter((m) => !dropIds.has(m.id));
            }
          }
          return prev.map((m) => {
            if (m.id !== pendingId) return m;
            const versions = [
              ...(m.versions || []),
              { text: m.text, sources: m.sources, modelName: m.modelName },
            ];
            return {
              ...m,
              status: "done",
              activity: null,
              versions,
              activeVersion: versions.length - 1,
            };
          });
        });
        pendingIdRef.current = null;
        setIsAsking(false);
        onTurnComplete?.();
      },
      onError: (message) => {
        // A failed regenerate must not destroy the prior answer: fall back to
        // the latest existing version (if any) and clear the error.
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== pendingId) return m;
            if (isRegenerate && m.versions?.length) {
              const last = m.versions.length - 1;
              const v = m.versions[last];
              return {
                ...m,
                status: "done",
                error: null,
                activity: null,
                text: v.text,
                sources: v.sources,
                modelName: v.modelName,
                activeVersion: last,
              };
            }
            return { ...m, status: "error", error: message, activity: null };
          }),
        );
        pendingIdRef.current = null;
        setIsAsking(false);
      },
    });
  }, [isAsking, socketState, onConversationIdReady, onConversationStart, onConversationTitle, onTurnComplete]);

  // Stop the in-flight turn. Flags the stop so onDone preserves the partial,
  // then closes the socket to terminate server-side generation immediately. A
  // no-op when nothing is streaming.
  const stop = useCallback(() => {
    if (!pendingIdRef.current) return;
    stoppedRef.current = true;
    stopStream();
  }, []);

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

  // Edit a previously-sent user message and re-ask. Mirrors `retry`'s truncate-
  // and-resend: everything from the edited turn onward is dropped, then `send`
  // appends the revised question plus a fresh assistant turn. A no-op edit (same
  // text after trimming) is ignored so an accidental save doesn't re-run a turn.
  const editMessage = useCallback(
    (userId, newText) => {
      const trimmed = newText.trim();
      if (!trimmed || isAsking) return;
      const index = messages.findIndex((m) => m.id === userId);
      if (index < 0 || messages[index].role !== "user") return;
      if (trimmed === messages[index].text.trim()) return;
      const removeIds = new Set(messages.slice(index).map((m) => m.id));
      setMessages((prev) => prev.filter((m) => !removeIds.has(m.id)));
      send(trimmed);
    },
    [messages, isAsking, send],
  );

  // Regenerate a completed answer in place: re-ask its question and stream a new
  // *version* into the same turn (no new user/assistant pair). The new version
  // is appended to the turn's < n/m > carousel and made active. Persists by
  // telling the backend to replace the last assistant turn (`regenerate: true`).
  const regenerate = useCallback(
    (assistantId) => {
      const index = messages.findIndex((m) => m.id === assistantId);
      if (index < 1) return;
      const userTurn = messages[index - 1];
      const question = userTurn?.role === "user" ? userTurn.text : null;
      if (!question) return;
      send(question, { regenerateId: assistantId });
    },
    [messages, send],
  );

  // Flip the < n/m > carousel to a specific stored version, mirroring its
  // text/sources/modelName up to the rendered top-level fields. Local-only:
  // reopening a conversation defaults to the latest version (see toMessage).
  const setActiveVersion = useCallback((assistantId, versionIndex) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId || !m.versions?.length) return m;
        const clamped = Math.max(0, Math.min(versionIndex, m.versions.length - 1));
        const v = m.versions[clamped];
        return {
          ...m,
          activeVersion: clamped,
          text: v.text,
          sources: v.sources,
          modelName: v.modelName,
        };
      }),
    );
  }, []);

  const newChat = useCallback(() => {
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    endSession(sessionIdRef.current);
    sessionIdRef.current = null;
    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsAsking(false);
    pendingIdRef.current = null;
    stoppedRef.current = false;
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
    stop,
    retry,
    editMessage,
    regenerate,
    setActiveVersion,
    newChat,
    loadConversation,
  };
}
