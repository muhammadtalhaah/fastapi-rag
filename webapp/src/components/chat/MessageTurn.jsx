import {
  Spinner,
  AppButton,
  CopyButton,
  AppTooltip,
} from "@/components/shared";
import MarkdownRenderer from "./MarkdownRenderer";
import { AlertTriangle, BookOpen, Brain, Globe } from "lucide-react";
import { forwardRef, memo, useCallback, useRef, useState } from "react";

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
  if (failed)
    return <Globe size={12} aria-hidden="true" className="text-muted" />;
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

// ─── Markdown body ─────────────────────────────────────────────────────────────

const BOTTOM_MARGIN = "mb-40";

const MarkdownBody = memo(
  ({ text, sources, isLast, status, modelName, onOpenSources }) => {
    // Keep onOpenSources in a ref so MarkdownRenderer's internal components map
    // never needs to change identity during streaming.
    const onCiteRef = useRef(null);
    onCiteRef.current = useCallback(
      (n) => onOpenSources(sources, n - 1),
      [onOpenSources, sources],
    );

    return (
      <div className={`mt-2 text-[0.95rem] ${isLast ? BOTTOM_MARGIN : ""}`}>
        <MarkdownRenderer text={text} onCite={(n) => onCiteRef.current(n)} />
        {status === "streaming" ? (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brass align-middle" />
        ) : null}
        {status === "done" ? (
          <div className="mt-3 flex items-center gap-1">
            <CopyButton
              getText={() => text}
              className="rounded-md p-1.5 hover:bg-surface"
            />
            <AppTooltip title={modelName || "Unknown model"}>
              <div className="inline-flex cursor-default items-center rounded-md p-1.5 text-muted transition-colors hover:bg-sidebar hover:text-ink">
                <Brain size={16} aria-hidden="true" />
              </div>
            </AppTooltip>
            {sources?.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenSources(sources)}
                className="flex items-center gap-1.5 border border-transparent px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-brass hover:text-brass"
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
  "rounded-sm ring-2 ring-brass/60 ring-offset-2 ring-offset-ground transition-[box-shadow] duration-700 motion-reduce:transition-none";

const MessageTurn = memo(
  forwardRef(
    ({ message, onRetry, isLast, isHighlighted, onOpenSources }, ref) => {
      const highlightClass = isHighlighted ? HIGHLIGHT_RING : "";

      if (message.role === "user") {
        return (
          <div ref={ref} className={`flex justify-end ${highlightClass}`}>
            <p className="max-w-[85%] border border-rule bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
              {message.text}
            </p>
          </div>
        );
      }

      const isLive =
        message.status === "pending" || message.status === "streaming";
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
            <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brass" />
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
    prev.isHighlighted === next.isHighlighted,
);

MessageTurn.displayName = "MessageTurn";

export default MessageTurn;
