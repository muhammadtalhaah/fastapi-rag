import Composer from "./Composer";
import MessageTurn from "./MessageTurn";
import { useAuth, useToast } from "@/context";
import { MessagesSquare } from "lucide-react";
import { StateBlock } from "@/components/shared";
import { SUGGESTIONS } from "@/config/dummyData";
import { useSearchParams } from "react-router-dom";
import { useChat, useConversations } from "@/hooks";
import { LoginModal, LoginPrompt } from "@/components/auth";
import { useCallback, useEffect, useRef, useState } from "react";

const ChatPage = () => {
  const { isAuthenticated, isLoading: isAuthLoading, oauthError } = useAuth();
  const { showToast } = useToast();
  const { refresh: refreshHistory, upsertConversation } = useConversations();
  // Driven by the ?c=<id> URL param: opening a conversation removes/sets it.
  // Declared up here so the not-found handler below can clear it.
  const [searchParams, setSearchParams] = useSearchParams();
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
  // A requested conversation that 404s/401s (deleted, or not ours / needs
  // sign-in) can't be opened. Tell the user and drop the dangling ?c= so the
  // URL-sync effect lands them on a fresh chat at the base Ask route.
  const handleConversationUnavailable = useCallback(() => {
    showToast("Chat not found.");
    setSearchParams({}, { replace: true });
  }, [showToast, setSearchParams]);
  const {
    messages,
    isAsking,
    isLoadingConversation,
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
    onConversationUnavailable: handleConversationUnavailable,
  });
  const endRef = useRef(null);

  // When it changes to an id we haven't loaded, pull that transcript in. An
  // absent param means a fresh chat.
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
    } else if (!conversationParam && activeConversationId) {
      newChat();
    }
  }, [activeConversationId, conversationParam, loadConversation, newChat]);

  // When a brand-new chat mints its conversation id, reflect it in the URL so a
  // refresh reopens it and the sidebar can highlight it.
  useEffect(() => {
    if (activeConversationId && activeConversationId !== conversationParam) {
      setSearchParams({ c: activeConversationId }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the active id
  }, [activeConversationId]);

  // Login dialog visibility, and whether the guest prompt was dismissed for
  // this session. Chatting is never blocked — the prompt is a soft nudge.
  const [loginOpen, setLoginOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Keep the newest turn in view as the transcript grows. On a freshly loaded
  // conversation jump instantly to the bottom (no visible scroll-through);
  // while chatting, follow new tokens smoothly.
  useEffect(() => {
    if (isLoadingConversation) return;
    endRef.current?.scrollIntoView({
      behavior: isAsking ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, isAsking, isLoadingConversation]);

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
    <div className="mx-auto flex w-full min-h-full max-w-4xl flex-1 flex-col px-4 sm_tablet:px-5">
      <div
        className={`flex flex-1 flex-col gap-6
        ${isEmpty ? "justify-center" : "justify-start pt-6 sm_tablet:pt-12"}
        `}
      >
        {isLoadingConversation ? (
          <></>
        ) : isEmpty ? (
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
          messages.map((message, idx) => (
            <MessageTurn
              key={message.id}
              message={message}
              onRetry={retry}
              isLast={messages.length - 1 === idx}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 bg-ground pb-2">
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
          AI can make mistakes. Verify all information against trusted sources before use.
        </p>
      </div>

      {showLoginModal ? <LoginModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
};

export default ChatPage;
