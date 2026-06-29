import { ChatSkeleton, Composer, MessageTurn, SourcesDrawer } from "@/components/chat";
import { useAuth, useToast } from "@/context";
import { MessagesSquare } from "lucide-react";
import { StateBlock } from "@/components/shared";
import { SUGGESTIONS } from "@/config/dummyData";
import { useSearchParams } from "react-router-dom";
import { useChat, useConversations, useScrollToBottom } from "@/hooks";
import { LoginModal, LoginPrompt } from "@/components/auth";
import { useCallback, useEffect, useRef, useState, memo } from "react";

// Isolated so that opening/closing the drawer doesn't re-render ChatPage or
// any MessageTurn. The parent passes a stable `openRef` (a ref to a setter)
// so MessageTurn can trigger the drawer without causing list re-renders.
const DrawerPortal = memo(({ openRef }) => {
  const [sources, setSources] = useState(null);
  // Expose the setter via ref so callers bypass React prop diffing entirely.
  openRef.current = setSources;
  return <SourcesDrawer sources={sources} onClose={() => setSources(null)} />;
});
DrawerPortal.displayName = "DrawerPortal";

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
  // Called synchronously (before React state commits) when the backend mints a
  // new conversation id. Keeping the ref current here prevents the URL-sync
  // effect from seeing a stale null and calling loadConversation on the new id.
  const handleConversationIdReady = useCallback((conversationId) => {
    activeConversationIdRef.current = conversationId;
  }, []);
  // A requested conversation that can't be loaded — deleted/not-ours (404·401)
  // or a server error (e.g. 502). Tell the user and drop the dangling ?c= so the
  // URL-sync effect lands them on a fresh chat at the base Ask route.
  const handleConversationUnavailable = useCallback(
    (_conversationId, status) => {
      // 404/401 → the chat is gone or not ours; anything else (e.g. 502) is a
      // server-side failure. Either way we drop ?c= so the URL-sync effect lands
      // the user on a fresh chat; the toast explains why.
      const message =
        status === 404 || status === 401
          ? "Chat not found."
          : "Couldn't load that conversation. Please try again.";
      showToast(message);
      setSearchParams({}, { replace: true });
    },
    [showToast, setSearchParams],
  );
  const {
    messages,
    isAsking,
    isLoadingConversation,
    socketState,
    activeConversationId,
    webSearch,
    setWebSearch,
    send,
    retry,
    editMessage,
    regenerate,
    setActiveVersion,
    newChat,
    loadConversation,
  } = useChat({
    onTurnComplete,
    onConversationStart: handleConversationStart,
    onConversationTitle: handleConversationTitle,
    onConversationUnavailable: handleConversationUnavailable,
    onConversationIdReady: handleConversationIdReady,
  });
  const endRef = useRef(null);
  // Keeps the conversation viewport pinned to its true bottom, re-pinning as
  // async content (markdown, code blocks, images, the sources ledger) settles.
  const scrollToBottom = useScrollToBottom(endRef);
  // Imperative handle to the Composer so we can return focus to its textarea
  // after a turn finishes streaming or when a fresh chat starts.
  const composerRef = useRef(null);
  // The DOM node of the message a search result pointed at, so we can scroll to
  // it once the transcript has loaded.
  const highlightRef = useRef(null);

  // When it changes to an id we haven't loaded, pull that transcript in. An
  // absent param means a fresh chat.
  const conversationParam = searchParams.get("c");
  // ?m=<index> — set when arriving from a search result that matched a specific
  // message. Parsed once into a number; null when absent/invalid.
  const messageParam = searchParams.get("m");
  const highlightIndex =
    messageParam != null && /^\d+$/.test(messageParam)
      ? Number(messageParam)
      : null;

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    // Keep the transcript aligned with the URL. A present ?c= opens that
    // conversation; removing ?c= while one is active means the user navigated
    // back to the base Ask route and expects a fresh chat.
    //
    // Use the ref here (not state) so we compare against the value that was
    // synchronously written when the conversation was minted — the state update
    // lags one render behind, which would otherwise make a brand-new ?c= look
    // like an unknown id and immediately call loadConversation, wiping the
    // in-progress transcript.
    if (conversationParam && conversationParam !== activeConversationIdRef.current) {
      loadConversation(conversationParam);
    } else if (!conversationParam && activeConversationIdRef.current) {
      newChat();
    }
  }, [conversationParam, loadConversation, newChat]);

  // When a brand-new chat mints its conversation id, reflect it in the URL so a
  // refresh reopens it and the sidebar can highlight it.
  useEffect(() => {
    if (activeConversationId && activeConversationId !== conversationParam) {
      setSearchParams({ c: activeConversationId }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the active id
  }, [activeConversationId]);

  // Login dialog visibility. Chatting is never blocked — the guest prompt is a
  // soft nudge that resurfaces every PROMPTS_PER_NUDGE user prompts.
  const [loginOpen, setLoginOpen] = useState(false);
  // Ref to DrawerPortal's internal setter — calling it opens the drawer without
  // touching ChatPage state, so the message list never re-renders on open/close.
  const drawerOpenRef = useRef(null);
  const openSources = useCallback((sources) => {
    drawerOpenRef.current?.(sources);
  }, []);
  // The user-prompt count at the last dismissal. The nudge reappears once the
  // user has sent another full batch past this baseline; dismissing again moves
  // the baseline forward, so the per-batch counter effectively resets each time.
  const [dismissedAtCount, setDismissedAtCount] = useState(0);

  // Keep the newest turn in view as the transcript grows. On a freshly loaded
  // conversation jump instantly to the true bottom (scrollToBottom re-pins
  // across frames so async content — markdown, code, images, the sources ledger
  // — can't strand the viewport partway down); while chatting, follow new
  // tokens smoothly. Suppressed while a search-result highlight is pending, so
  // we don't yank the user to the bottom instead of the message they searched
  // for, and while still loading so we wait until messages have rendered.
  useEffect(() => {
    if (isLoadingConversation || highlightIndex != null) return;
    scrollToBottom(isAsking ? "smooth" : "auto");
  }, [messages, isAsking, isLoadingConversation, highlightIndex, scrollToBottom]);

  // Arriving from a search result: once the targeted conversation has finished
  // loading and the message exists, scroll it into view, then drop ?m= so the
  // highlight is a one-shot (a later send / scroll won't re-trigger it). The
  // transient highlight ring itself is driven by the `m` param on MessageTurn,
  // so clearing it also fades the ring out.
  useEffect(() => {
    if (highlightIndex == null || isLoadingConversation) return;
    if (highlightIndex >= messages.length) return;
    const node = highlightRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("m");
      setSearchParams(next, { replace: true });
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when the target lands
  }, [highlightIndex, isLoadingConversation, messages.length]);

  const isEmpty = messages.length === 0;
  const isSocketReady = socketState === "OPEN";
  const isComposerDisabled = isAsking || !isSocketReady;

  // Return focus to the composer so the user can keep typing without clicking:
  // when a response finishes streaming (isAsking falls to false) and when a
  // fresh chat is started (no active conversation). Guarded on the composer
  // being enabled so we don't focus a disabled input mid-request or while the
  // socket is still connecting.
  const wasAskingRef = useRef(false);
  useEffect(() => {
    const finishedStreaming = wasAskingRef.current && !isAsking;
    wasAskingRef.current = isAsking;
    if (finishedStreaming && isSocketReady) {
      composerRef.current?.focus();
    }
  }, [isAsking, isSocketReady]);

  useEffect(() => {
    // A new chat (base Ask route, no conversation loaded) lands ready to type.
    if (!activeConversationId && !isLoadingConversation && isSocketReady) {
      composerRef.current?.focus();
    }
  }, [activeConversationId, isLoadingConversation, isSocketReady]);
  // Show the modal when the user opened it, or when we returned from a failed
  // Google sign-in (derived, so the error surfaces without an effect-driven
  // setState). Closing clears the explicit-open flag; the OAuth error is
  // cleared by the modal on unmount.
  const showLoginModal = loginOpen || Boolean(oauthError);
  // The nudge resurfaces every N user prompts, counted from the last dismissal.
  const PROMPTS_PER_NUDGE = 3;
  const userPromptCount = messages.filter((m) => m.role === "user").length;
  // Show the guest prompt only once we know the user is logged out, and only
  // after they've sent another full batch of prompts since the last dismissal.
  // No prompts yet → baseline 0 → nothing shown until the 3rd prompt.
  const showLoginPrompt =
    !isAuthLoading &&
    !isAuthenticated &&
    userPromptCount - dismissedAtCount >= PROMPTS_PER_NUDGE;

  return (
    <div className="mx-auto flex w-full min-h-full max-w-3xl flex-1 flex-col px-4 sm_tablet:px-5">
      <div
        className={`flex flex-1 flex-col gap-6
        ${isEmpty && !isLoadingConversation ? "justify-center" : "justify-start pt-6 sm_tablet:pt-12"}
        `}
      >
        {isLoadingConversation ? (
          <ChatSkeleton />
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
              ref={highlightIndex === idx ? highlightRef : null}
              message={message}
              onRetry={retry}
              onRegenerate={regenerate}
              onSelectVersion={setActiveVersion}
              onEditMessage={editMessage}
              isAuthenticated={isAuthenticated}
              canRegenerate={!isComposerDisabled}
              isLast={messages.length - 1 === idx}
              isHighlighted={highlightIndex === idx}
              onOpenSources={openSources}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 bg-ground pb-2">
        {!isSocketReady ? (
          <p className="text-center text-xs text-muted">
            {socketState === "CONNECTING" ? "Connecting…" : "Reconnecting…"}
          </p>
        ) : null}
        {showLoginPrompt ? (
          <LoginPrompt
            onLogin={() => setLoginOpen(true)}
            onDismiss={() => setDismissedAtCount(userPromptCount)}
          />
        ) : null}
        <Composer
          ref={composerRef}
          onSubmit={send}
          disabled={isComposerDisabled}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
        />
        <p className="text-center text-xs !text-muted">
          AI can make mistakes. Verify all information.
        </p>
      </div>

      {showLoginModal ? (
        <LoginModal onClose={() => setLoginOpen(false)} />
      ) : null}

      <DrawerPortal openRef={drawerOpenRef} />
    </div>
  );
};

export default ChatPage;
