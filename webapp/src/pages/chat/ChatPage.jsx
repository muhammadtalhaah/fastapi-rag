import { useChat, useConversations } from "@/hooks";
import Composer from "./Composer";
import MessageTurn from "./MessageTurn";
import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const { isAuthenticated, isLoading: isAuthLoading, oauthError } = useAuth();
  const { refresh: refreshHistory, upsertConversation } = useConversations();
  const activeConversationIdRef = useRef(null);
  // Refresh the sidebar history after each completed turn so a new conversation
  // appears immediately.
  const onTurnComplete = useCallback(() => {
    if (activeConversationIdRef.current) {
      upsertConversation({
        id: activeConversationIdRef.current,
        isGeneratingTitle: false,
        updatedAt: new Date().toISOString(),
      });
    }
    refreshHistory();
  }, [refreshHistory, upsertConversation]);
  const handleConversationStart = useCallback(
    (conversationId) => {
      upsertConversation({
        id: conversationId,
        title: "",
        updatedAt: new Date().toISOString(),
        isGeneratingTitle: true,
      });
    },
    [upsertConversation],
  );
  const handleConversationTitle = useCallback(
    (conversationId, title) => {
      upsertConversation({
        id: conversationId,
        title: title || "",
        updatedAt: new Date().toISOString(),
        isGeneratingTitle: true,
      });
    },
    [upsertConversation],
  );
  const {
    messages,
    isAsking,
    connectionState,
    connectionMessage,
    activeConversationId,
    send,
    retry,
    newChat,
    loadConversation,
  } = useChat({
    onTurnComplete,
    onConversationStart: handleConversationStart,
    onConversationTitle: handleConversationTitle,
  });
  const endRef = useRef(null);

  // The selected conversation is driven by the ?c=<id> URL param (per the
  // codebase's "route-relevant state in the URL" convention). When it changes to
  // an id we haven't loaded, pull that transcript in. An absent param means a
  // fresh chat.
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationParam = searchParams.get("c");

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    // Keep the transcript aligned with the URL. A present ?c= opens that
    // conversation; removing ?c= while one is active means the user navigated
    // back to the base Ask route and expects a fresh chat.
    if (conversationParam && conversationParam !== activeConversationId) {
      loadConversation(conversationParam);
    } else if (!conversationParam && activeConversationId && messages.length === 0) {
      newChat();
    }
  }, [activeConversationId, conversationParam, loadConversation, messages.length, newChat]);

  // When a brand-new chat mints its conversation id, reflect it in the URL so a
  // refresh reopens it and the sidebar can highlight it.
  useEffect(() => {
    if (activeConversationId && activeConversationId !== conversationParam) {
      setSearchParams({ c: activeConversationId }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the active id
  }, [activeConversationId]);

  // "New chat" clears both the transcript and the URL param.
  const handleNewChat = useCallback(() => {
    newChat();
    setSearchParams({}, { replace: true });
  }, [newChat, setSearchParams]);

  // Login dialog visibility, and whether the guest prompt was dismissed for
  // this session. Chatting is never blocked — the prompt is a soft nudge.
  const [loginOpen, setLoginOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const isEmpty = messages.length === 0;
  const isConnecting = connectionState === "connecting" || connectionState === "retrying";
  const isComposerDisabled = isAsking || isConnecting;
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
          {!isEmpty ? (
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isComposerDisabled}
              className="flex items-center gap-1.5 border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-brass hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenSquare size={14} />
              New chat
            </button>
          ) : null}
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
                    disabled={isComposerDisabled}
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
        {connectionMessage ? (
          <p role="status" aria-live="polite" className="text-center text-xs text-muted">
            {connectionMessage}
          </p>
        ) : null}
        {showLoginPrompt ? (
          <LoginPrompt
            onLogin={() => setLoginOpen(true)}
            onDismiss={() => setPromptDismissed(true)}
          />
        ) : null}
        <Composer onSubmit={send} disabled={isComposerDisabled} />
        <p className="text-center text-xs text-ink">
          AI can make mistakes. Verify all information against
          trusted sources before use.
        </p>
      </div>

      {showLoginModal ? <LoginModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
};

export default ChatPage;
