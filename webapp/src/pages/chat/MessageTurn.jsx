import { AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner, AppButton } from "@/components/shared";
import SourcesLedger from "./SourcesLedger";

// Tailwind prose-style component map for react-markdown.
const mdComponents = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-ink">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-xl font-semibold text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold text-ink">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-base font-semibold text-ink">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-ink">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-ink">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-surface px-1 py-0.5 font-mono text-sm text-brass">
        {children}
      </code>
    ) : (
      <pre className="mb-3 overflow-x-auto rounded border border-rule bg-surface p-3">
        <code className="font-mono text-sm text-ink">{children}</code>
      </pre>
    ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-brass pl-3 italic text-ink/70">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-rule" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brass underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-rule bg-surface px-3 py-1.5 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-rule px-3 py-1.5 text-ink">{children}</td>
  ),
};

const CENTALIZED_BOTTOM_MARGIN = "mb-40";

const MessageTurn = ({ message, onRetry, isLast }) => {
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
  const activityLabel = message.activity || null;

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Answer
        </span>
      </div>

      {isLive && activityLabel ? (
        <div className="mt-2">
          <Spinner label={activityLabel} />
        </div>
      ) : null}

      {(message.status === "streaming" || message.status === "done") && message.text ? (
        <div
          className={`mt-2 text-[0.95rem] ${message.sources?.length > 0 ? "" : isLast && CENTALIZED_BOTTOM_MARGIN} `}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {message.text}
          </ReactMarkdown>
          {message.status === "streaming" ? (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-brass align-middle" />
          ) : null}
        </div>
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

      {(message.status === "streaming" || message.status === "done") &&
      message.sources?.length > 0 ? (
        <div
          className={`
        ${message.sources?.length > 0 && isLast ? CENTALIZED_BOTTOM_MARGIN : ""}
        `}
        >
          <SourcesLedger sources={message.sources} />
        </div>
      ) : null}
    </div>
  );
};

export default MessageTurn;
