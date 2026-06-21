import { AlertTriangle } from "lucide-react";
import { Spinner, AppButton } from "@/components/shared";
import SourcesLedger from "./SourcesLedger";

// Maps internal stage keys to human-readable labels shown during streaming.
const STAGE_LABELS = {
  embedding: "Understanding your question…",
  searching: "Searching documents…",
  thinking: "Thinking…",
  generating: "Generating answer…",
};

// Renders one message. User questions are right-aligned chips; assistant
// answers are full-width with their sources ledger attached beneath.
const MessageTurn = ({ message, onRetry }) => {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] border border-rule bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
          {message.text}
        </p>
      </div>
    );
  }

  const isLive = message.status === "pending" || message.status === "streaming";
  const activityLabel =
    message.activity || (message.status === "pending" ? "Connecting…" : null);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Answer
        </span>
      </div>

      {/* Activity indicator — shown during pending and between status events */}
      {isLive && activityLabel ? (
        <div className="mt-2">
          <Spinner label={activityLabel} />
        </div>
      ) : null}

      {/* Live text — appears as tokens stream in, stays for final done state */}
      {(message.status === "streaming" || message.status === "done") && message.text ? (
        <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">
          {message.text}
          {message.status === "streaming" ? (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-brass align-middle" />
          ) : null}
        </p>
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

      {/* Sources appear once retrieved, visible during generation and after */}
      {(message.status === "streaming" || message.status === "done") &&
      message.sources?.length > 0 ? (
        <SourcesLedger sources={message.sources} />
      ) : null}
    </div>
  );
};

export default MessageTurn;
