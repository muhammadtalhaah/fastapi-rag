import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { StateBlock } from "@/components/shared";
import { ROUTES } from "@/config";
import { useChat } from "./useChat";
import MessageTurn from "./MessageTurn";
import Composer from "./Composer";

const SUGGESTIONS = [
  "What are the key findings?",
  "Summarize the main argument.",
  "What does it say about pricing?",
];

const ChatPage = () => {
  const { messages, isAsking, send, retry } = useChat();
  const endRef = useRef(null);

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="border-b border-rule pb-5">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
          01 · Ask
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight text-ink sm_desktop:text-4xl">
          Ask the archive
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Every answer is drawn from your uploaded documents and shows the exact
          passages it came from.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
        {isEmpty ? (
          <StateBlock
            variant="empty"
            icon={MessagesSquare}
            title="Nothing asked yet"
            message="Pose a question below, or start with one of these."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-brass hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            }
          />
        ) : (
          messages.map((message) => (
            <MessageTurn key={message.id} message={message} onRetry={retry} />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2">
        <Composer onSubmit={send} disabled={isAsking} />
        <p className="text-center text-xs text-muted">
          No documents yet?{" "}
          <Link
            to={ROUTES.UPLOAD}
            className="text-brass underline-offset-2 hover:underline"
          >
            Upload one
          </Link>{" "}
          to begin.
        </p>
      </div>
    </div>
  );
};

export default ChatPage;
