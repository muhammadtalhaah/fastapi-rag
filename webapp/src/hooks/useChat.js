import { useCallback, useRef, useState } from "react";
import { askStream, endSession } from "@/services/chatService";
import { getConversation } from "@/services/conversationService";
import { DEFAULT_TOP_K } from "@/config";

let nextId = 1;
const makeId = () => `m${nextId++}`;

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
export function useChat({ onTurnComplete, onConversationStart, onConversationTitle } = {}) {
  const [messages, setMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [activeConversationId, setActiveConversationId] = useState(null);
  const sessionIdRef = useRef(null);
  const conversationIdRef = useRef(null);

  const send = useCallback(async (question) => {
    const trimmed = question.trim();
    if (!trimmed || isAsking || connectionState === "connecting" || connectionState === "retrying") return;

    const userMessage = { id: makeId(), role: "user", text: trimmed };
    const pendingId = makeId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: pendingId, role: "assistant", status: "pending", text: "", sources: [], activity: null },
    ]);
    setIsAsking(true);
    setConnectionState("connecting");
    setConnectionMessage("Connecting to the chat service...");

    const patch = (fields) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, ...fields } : m))
      );

    await askStream(trimmed, DEFAULT_TOP_K, sessionIdRef.current, conversationIdRef.current, {
      onSession: (sessionId) => {
        sessionIdRef.current = sessionId;
      },
      onConversation: (conversationId) => {
        const isNewConversation = !conversationIdRef.current;
        conversationIdRef.current = conversationId;
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
      onStatus: (stage, message) => {
        if (stage === "connecting" || stage === "retrying") {
          setConnectionState(stage);
          setConnectionMessage(message || "");
          patch({ status: "pending", activity: message });
          return;
        }

        setConnectionState("connected");
        setConnectionMessage(message || "");
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
        setConnectionState("idle");
        setConnectionMessage("");
        // Refresh again after completion so ordering/title updates from the
        // finished answer are reflected in the sidebar.
        onTurnComplete?.();
      },
      onError: (message) => {
        patch({ status: "error", error: message, activity: null });
        setIsAsking(false);
        setConnectionState("error");
        setConnectionMessage(message || "Unable to connect to the chat service.");
      },
    });
  }, [connectionState, isAsking, onConversationStart, onConversationTitle, onTurnComplete]);

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

  // Close the current conversation and start fresh. Evicts the server context
  // session and clears the transcript; the next `send` mints a new conversation.
  // Note: the durable history thread is NOT deleted — it stays in the sidebar.
  const newChat = useCallback(() => {
    endSession(sessionIdRef.current);
    sessionIdRef.current = null;
    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsAsking(false);
    setConnectionState("idle");
    setConnectionMessage("");
  }, []);

  // Load a past conversation into the transcript so the user can continue it.
  // Resets the in-memory context session (it doesn't survive server restarts and
  // isn't persisted), but keeps the durable conversation id so new turns append
  // to the same DB thread.
  const loadConversation = useCallback(async (conversationId) => {
    if (!conversationId || isAsking) return;
    try {
      const convo = await getConversation(conversationId);
      sessionIdRef.current = null;
      conversationIdRef.current = convo.id;
      setActiveConversationId(convo.id);
      setMessages(convo.messages);
      setIsAsking(false);
      setConnectionState("idle");
      setConnectionMessage("");
    } catch {
      // Surface a minimal error turn rather than failing silently.
      setMessages([
        {
          id: makeId(),
          role: "assistant",
          status: "error",
          text: "",
          error: "Couldn't load that conversation.",
          sources: [],
        },
      ]);
      setConnectionState("error");
      setConnectionMessage("Couldn't load that conversation.");
    }
  }, [isAsking]);

  return {
    messages,
    isAsking,
    connectionState,
    connectionMessage,
    activeConversationId,
    send,
    retry,
    newChat,
    loadConversation,
  };
}
