import { useCallback, useState } from "react";
import { askStream } from "@/services/chatService";
import { DEFAULT_TOP_K } from "@/config";

let nextId = 1;
const makeId = () => `m${nextId++}`;

// Owns the conversation transcript. Each turn is independent (single-turn RAG).
// The assistant message goes through these statuses:
//   "pending"    — waiting for first byte
//   "streaming"  — tokens are arriving (text is built incrementally)
//   "done"       — complete
//   "error"      — failed
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

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

    await askStream(trimmed, DEFAULT_TOP_K, {
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
      const question = messages[index - 1]?.text;
      if (!question) return;
      setMessages((prev) =>
        prev.filter((m) => m.id !== failedId && m.id !== messages[index - 1]?.id)
      );
      send(question);
    },
    [messages, send],
  );

  return { messages, isAsking, send, retry };
}
