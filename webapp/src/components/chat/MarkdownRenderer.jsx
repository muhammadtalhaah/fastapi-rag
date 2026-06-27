import { memo, useMemo, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CopyButton } from "@/components/shared";

// ─── Citation helpers ─────────────────────────────────────────────────────────

const CITE_RE = /(\[\d+\])/g;

const parseCitations = (text, onCiteRef) =>
  text.split(CITE_RE).map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;
    const n = parseInt(match[1], 10);
    return (
      <sup key={i}>
        <button
          type="button"
          onClick={() => onCiteRef.current(n)}
          className="ml-0.5 cursor-pointer rounded px-0.5 font-mono text-[0.65em] text-brass underline underline-offset-2 transition-colors hover:text-brass/70"
          aria-label={`Source ${n}`}
        >
          {n}
        </button>
      </sup>
    );
  });

const injectCitations = (children, onCiteRef) => {
  if (Array.isArray(children))
    return children.map((child) =>
      typeof child === "string" ? parseCitations(child, onCiteRef) : child,
    );
  if (typeof children === "string") return parseCitations(children, onCiteRef);
  return children;
};

// ─── Component map ────────────────────────────────────────────────────────────

const nodeText = (node) => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node.props) return nodeText(node.props.children);
  return "";
};

const makeMdComponents = (onCiteRef) => ({
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-ink">
      {injectCitations(children, onCiteRef)}
    </p>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{injectCitations(children, onCiteRef)}</li>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 border-b border-rule pb-1.5 text-3xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-2xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-4 text-lg font-semibold text-ink first:mt-0">
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
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children, ...props }) => {
    const isBlock = /\blanguage-/.test(className || "");
    if (isBlock)
      return (
        <code className={`hljs font-mono text-sm ${className || ""}`} {...props}>
          {children}
        </code>
      );
    return (
      <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-brass">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
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
});

// ─── Static plugin arrays ─────────────────────────────────────────────────────

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [[rehypeHighlight, { detect: true, ignoreMissing: true }]];

// ─── MarkdownRenderer ─────────────────────────────────────────────────────────

/**
 * Renders markdown text with syntax highlighting and clickable citation
 * superscripts ([1], [2] → calls onCite with the 1-based index).
 *
 * Memoized: only re-renders when `text` changes. The `onCite` callback is kept
 * in a ref so the components map is created once and never invalidated.
 */
const MarkdownRenderer = memo(({ text, onCite }) => {
  const onCiteRef = useRef(null);
  onCiteRef.current = useCallback((n) => onCite?.(n), [onCite]);

  const components = useMemo(() => makeMdComponents(onCiteRef), []);

  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
