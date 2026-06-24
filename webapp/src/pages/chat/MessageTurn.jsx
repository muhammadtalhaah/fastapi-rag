import { AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Spinner, AppButton, CopyButton } from "@/components/shared";
import SourcesLedger from "./SourcesLedger";

// Recursively pull the plain text out of react-markdown's rendered children so a
// code block can be copied verbatim (the children are React nodes, not a string).
const nodeText = (node) => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node.props) return nodeText(node.props.children);
  return "";
};

// Tailwind prose-style component map for react-markdown.
const mdComponents = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-ink">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 border-b border-rule pb-1.5 text-xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-4 text-base font-semibold text-ink first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-muted first:mt-0">
      {children}
    </h4>
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
  // In react-markdown v10 the `inline` prop is gone; block code is the only
  // child of a <pre>, inline code is not. We detect a fenced block by the
  // `language-*` class that rehype-highlight/remark attaches, and let the
  // `pre` renderer below own the block chrome (border, padding, scroll).
  code: ({ className, children, ...props }) => {
    const isBlock = /\blanguage-/.test(className || "");
    if (isBlock) {
      return (
        <code className={`hljs font-mono text-sm ${className || ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-brass">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    // Pull the language tag off the inner <code> for the corner label.
    const codeEl = Array.isArray(children) ? children[0] : children;
    const lang = (codeEl?.props?.className || "")
      .split(/\s+/)
      .find((c) => c.startsWith("language-"))
      ?.replace("language-", "");
    return (
      <div className="group relative mb-3 overflow-hidden rounded border border-rule bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-1">
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted">
            {lang || "text"}
          </span>
          <CopyButton getText={() => nodeText(children)} title="Copy code" />
        </div>
        <pre className="overflow-x-auto p-3 leading-relaxed">{children}</pre>
      </div>
    );
  },
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
            components={mdComponents}
          >
            {message.text}
          </ReactMarkdown>
          {message.status === "streaming" ? (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-brass align-middle" />
          ) : null}
          {message.status === "done" ? (
            <div className="mt-3">
              <CopyButton
                getText={() => message.text}
                label="Copy response"
                copiedLabel="Copied"
                title="Copy response"
              />
            </div>
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
