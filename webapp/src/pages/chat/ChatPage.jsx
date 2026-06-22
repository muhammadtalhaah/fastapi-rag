import { useChat } from "@/hooks";
import Composer from "./Composer";
import MessageTurn from "./MessageTurn";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ROUTES } from "../../config/routes";
import { MessagesSquare, PenSquare } from "lucide-react";
import { StateBlock } from "@/components/shared";
import { LoginModal, LoginPrompt } from "@/components/auth";
import { useAuth } from "@/context";

const SUGGESTIONS = [
  "What are the key findings?",
  "Summarize the main argument.",
  "What does it say about pricing?",
];

const ChatPage = () => {
  const { messages, isAsking, send, retry, newChat } = useChat();
  const { isAuthenticated, isLoading: isAuthLoading, oauthError } = useAuth();
  const endRef = useRef(null);

  // Login dialog visibility, and whether the guest prompt was dismissed for
  // this session. Chatting is never blocked — the prompt is a soft nudge.
  const [loginOpen, setLoginOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const isEmpty = messages.length === 0;
  // Show the modal when the user opened it, or when we returned from a failed
  // Google sign-in (derived, so the error surfaces without an effect-driven
  // setState). Closing clears the explicit-open flag; the OAuth error is
  // cleared by the modal on unmount.
  const showLoginModal = loginOpen || Boolean(oauthError);
  // Show the guest prompt only once we know the user is logged out, and only
  // until they dismiss it (or sign in).
  const showLoginPrompt = !isAuthLoading && !isAuthenticated && !promptDismissed;

  return (
    <div className="flex h-screen flex-col max-h-screen overflow-hidden justify-between">
      <header className="flex-1 border-b border-rule flex-grow-0 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
              01 · Ask
            </span>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight text-ink sm_desktop:text-4xl">
              Ask the archive
            </h1>
          </div>
          {!isEmpty && (
            <button
              type="button"
              onClick={newChat}
              disabled={isAsking}
              className="flex items-center gap-1.5 border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-brass hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenSquare size={14} />
              New chat
            </button>
          )}
        </div>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Every answer is drawn from your uploaded documents and shows the exact passages
          it came from.
        </p>
      </header>

      <div
        className={`flex flex-1 flex-col gap-6 overflow-y-auto flex-grow-1
        ${isEmpty ? "justify-center" : "justify-start  pt-20"}
        `}
      >
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

      <div className="flex-1 flex flex-col gap-2 flex-grow-0 pb-2">
        {showLoginPrompt ? (
          <LoginPrompt
            onLogin={() => setLoginOpen(true)}
            onDismiss={() => setPromptDismissed(true)}
          />
        ) : null}
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

      {showLoginModal ? <LoginModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
};

export default ChatPage;
