import {
  Brain,
  Globe,
  BookOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import UserMessage from "./UserMessage";
import MarkdownRenderer from "./MarkdownRenderer";
import { forwardRef, memo, useCallback, useRef, useState } from "react";
import { Spinner, AppButton, CopyButton, AppTooltip } from "@/components/shared";
import { useTranslation } from "@/context";

const MAX_FAVICONS = 3;

// ─── Favicon helpers ──────────────────────────────────────────────────────────

const FaviconImg = memo(({ url }) => {
  const [failed, setFailed] = useState(false);
  let origin = url;
  try {
    origin = new URL(url).origin;
  } catch {
    /* keep raw url */
  }
  if (failed) return <Globe size={12} aria-hidden="true" className="text-muted" />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${origin}`}
      alt=""
      aria-hidden="true"
      width={14}
      height={14}
      className="rounded-full ring-1 ring-ground"
      onError={() => setFailed(true)}
    />
  );
});
FaviconImg.displayName = "FaviconImg";

const FaviconStack = memo(({ sources }) => {
  const webSources = sources.filter((s) => s.type === "web" && s.url);
  if (!webSources.length) return <BookOpen size={16} aria-hidden="true" />;
  const visible = webSources.slice(0, MAX_FAVICONS);
  const overflow = webSources.length - visible.length;
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center -space-x-1">
        {visible.map((src) => (
          <FaviconImg key={src.url} url={src.url} />
        ))}
      </span>
      {overflow > 0 && (
        <span className="font-mono text-[10px] text-muted">+{overflow}</span>
      )}
    </span>
  );
});
FaviconStack.displayName = "FaviconStack";

// ─── Version pager ─────────────────────────────────────────────────────────────

// A compact "< n/m >" control for flipping between regenerated answer versions
// of a single turn. Only rendered when a turn has more than one version. The
// arrows are disabled at the ends and while a response is streaming (canPage).
const VersionPager = memo(({ activeVersion, versionCount, onSelectVersion, canPage }) => {
  if (versionCount <= 1) return null;
  const atFirst = activeVersion <= 0;
  const atLast = activeVersion >= versionCount - 1;
  const arrowClass =
    "inline-flex items-center rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";
  return (
    <span className="flex items-center gap-0.5 font-mono text-xs text-muted">
      <button
        type="button"
        onClick={() => onSelectVersion(activeVersion - 1)}
        disabled={!canPage || atFirst}
        aria-label="Previous version"
        className={arrowClass}
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <span className="tabular-nums">
        {activeVersion + 1}/{versionCount}
      </span>
      <button
        type="button"
        onClick={() => onSelectVersion(activeVersion + 1)}
        disabled={!canPage || atLast}
        aria-label="Next version"
        className={arrowClass}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </span>
  );
});
VersionPager.displayName = "VersionPager";

// ─── Markdown body ─────────────────────────────────────────────────────────────

// Resting gap below the last (completed) message so it isn't flush with the
// composer. While the assistant is actively streaming we balloon this to ~half
// the viewport so the growing response stays comfortably centered instead of
// hugging the bottom edge; it collapses back the moment the turn completes.
// `transition-[margin]` keeps that collapse smooth rather than a hard jump.
const BOTTOM_MARGIN = "mb-40";
const STREAMING_BOTTOM_MARGIN = "mb-32";
const BOTTOM_MARGIN_TRANSITION =
  "transition-[margin] duration-300 ease-out motion-reduce:transition-none";

const MarkdownBody = memo(
  ({
    text,
    sources,
    isLast,
    status,
    modelName,
    onOpenSources,
    onRegenerate,
    canRegenerate,
    activeVersion,
    versionCount,
    onSelectVersion,
  }) => {
    const { t } = useTranslation();
    // Keep onOpenSources in a ref so MarkdownRenderer's internal components map
    // never needs to change identity during streaming.
    const onCiteRef = useRef(null);
    onCiteRef.current = useCallback(
      (n) => onOpenSources(sources, n - 1),
      [onOpenSources, sources],
    );

    // Only the last message carries bottom spacing; while it's streaming the
    // gap grows to keep the live content centered, then collapses on "done".
    const bottomMargin = isLast
      ? `${status === "streaming" ? STREAMING_BOTTOM_MARGIN : BOTTOM_MARGIN} ${BOTTOM_MARGIN_TRANSITION}`
      : "";

    return (
      <div className={`font-chat text-[0.95rem] ${bottomMargin}`}>
        <MarkdownRenderer
          text={text}
          sources={sources}
          onCite={(n) => onCiteRef.current(n)}
        />
        {status === "streaming" ? (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary align-middle" />
        ) : null}
        {status === "done" ? (
          <div className="mt-3 flex items-center gap-1">
            <VersionPager
              activeVersion={activeVersion}
              versionCount={versionCount}
              onSelectVersion={onSelectVersion}
              canPage={canRegenerate}
            />
            <CopyButton
              getText={() => text}
              className="rounded-md p-1.5 hover:bg-surface"
            />
            {onRegenerate ? (
              <AppTooltip title={t("regenerate")}>
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={!canRegenerate}
                  aria-label={t("regenerate")}
                  className="inline-flex items-center rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              </AppTooltip>
            ) : null}
            <AppTooltip
              title={modelName ? t("used") + " " + modelName : t("unknownModel")}
            >
              <div className="inline-flex cursor-default items-center rounded-md p-1.5 text-muted transition-colors hover:bg-sidebar hover:text-ink">
                <Brain size={16} aria-hidden="true" />
              </div>
            </AppTooltip>
            {sources?.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenSources(sources)}
                className="flex items-center gap-1.5 border border-transparent px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <FaviconStack sources={sources} />
                {(() => {
                  const webCount = sources.filter(
                    (s) => s.type === "web" && s.url,
                  ).length;
                  return webCount > MAX_FAVICONS
                    ? "sources"
                    : `${sources.length} ${sources.length === 1 ? "source" : "sources"}`;
                })()}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);
MarkdownBody.displayName = "MarkdownBody";

// ─── MessageTurn ──────────────────────────────────────────────────────────────

const HIGHLIGHT_RING =
  "rounded-sm ring-2 ring-primary/60 ring-offset-2 ring-offset-ground transition-[box-shadow] duration-700 motion-reduce:transition-none";

const MessageTurn = memo(
  forwardRef(
    (
      {
        message,
        onRetry,
        onRegenerate,
        onSelectVersion,
        onEditMessage,
        isAuthenticated,
        canRegenerate,
        isLast,
        isHighlighted,
        onOpenSources,
      },
      ref,
    ) => {
      const highlightClass = isHighlighted ? HIGHLIGHT_RING : "";

      if (message.role === "user") {
        return (
          <div ref={ref} className={highlightClass}>
            <UserMessage
              message={message}
              isAuthenticated={isAuthenticated}
              canEdit={canRegenerate}
              onEdit={onEditMessage}
            />
          </div>
        );
      }

      const isLive = message.status === "pending" || message.status === "streaming";
      const activityLabel = message.activity || null;
      const hasText = Boolean(message.text);

      return (
        <div ref={ref} className={`flex flex-col ${highlightClass}`}>
          {/* Status line — sits above the message/dot while generating. */}
          {isLive && activityLabel ? (
            <div className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
              <Spinner size={13} />
              <span className="animate-pulse">{activityLabel}</span>
            </div>
          ) : null}

          {/* Before any text arrives, a standalone blinking dot marks the start. */}
          {isLive && !hasText ? (
            <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          ) : null}

          {(message.status === "streaming" || message.status === "done") &&
          message.text ? (
            <MarkdownBody
              text={message.text}
              sources={message.sources}
              isLast={isLast}
              status={message.status}
              modelName={message.modelName}
              onOpenSources={onOpenSources}
              onRegenerate={
                isAuthenticated && onRegenerate ? () => onRegenerate(message.id) : null
              }
              canRegenerate={canRegenerate}
              activeVersion={message.activeVersion ?? 0}
              versionCount={message.versions?.length ?? 0}
              onSelectVersion={(index) => onSelectVersion?.(message.id, index)}
            />
          ) : null}

          {message.status === "error" ? (
            <div className="mt-2 flex flex-col items-start gap-3 border border-danger/40 bg-danger/5 px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-danger">
                <AlertTriangle size={15} aria-hidden="true" />
                {message.error}
              </p>
              <AppButton variant="ghost" onClick={() => onRetry(message.id)}>
                Try again
              </AppButton>
            </div>
          ) : null}
        </div>
      );
    },
  ),
  (prev, next) =>
    prev.message === next.message &&
    prev.isLast === next.isLast &&
    prev.isHighlighted === next.isHighlighted &&
    prev.canRegenerate === next.canRegenerate &&
    prev.onRegenerate === next.onRegenerate &&
    prev.isAuthenticated === next.isAuthenticated &&
    prev.onEditMessage === next.onEditMessage,
);

MessageTurn.displayName = "MessageTurn";

export default MessageTurn;
