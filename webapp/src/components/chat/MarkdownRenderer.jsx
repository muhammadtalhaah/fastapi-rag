import { memo, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CopyButton } from "@/components/shared";
import CitationChip from "./CitationChip";

// ─── Raw <br> handling ──────────────────────────────────────────────────────
//
// Models often emit literal <br> tags to break lines inside markdown table
// cells (which can't hold real newlines). react-markdown escapes raw HTML by
// default — and we deliberately keep it that way (no rehype-raw) to avoid an
// XSS surface — so those tags would otherwise show up as visible "<br>" text.
//
// We pre-replace every <br> variant with a private-use sentinel character
// BEFORE markdown parsing, then split text nodes on that sentinel at render
// time and inject real <br/> elements. This converts the breaks safely without
// enabling arbitrary HTML, and works everywhere a text node can appear
// (paragraphs, list items, table cells).
const BR_SENTINEL = "";
const BR_TAG_RE = /<br\s*\/?>/gi;

const replaceBrTags = (text) =>
  typeof text === "string" ? text.replace(BR_TAG_RE, BR_SENTINEL) : text;

// ─── Citation helpers ─────────────────────────────────────────────────────────

// Matches a *run* of one or more citation markers — `[1]`, `[1][2]`, or
// `[1] [2]` with incidental whitespace between them. Each run collapses into a
// single grouped CitationChip ("Source name +N") rather than separate pills.
const CITE_RUN_RE = /(\[\d+\](?:\s*\[\d+\])*)/g;
const CITE_NUM_RE = /\[(\d+)\]/g;

// `citeCtx` is a ref holding `{ onCite, sources }` so the components map (built
// once) can always read the latest callback + source list without changing
// identity. Citation numbers are 1-based → map to `sources[n - 1]`.
const renderCiteRun = (part, key, citeCtx) => {
  const nums = [...part.matchAll(CITE_NUM_RE)].map((m) => parseInt(m[1], 10));
  if (!nums.length) return part;
  const ctx = citeCtx.current;
  // Pair each citation number with its resolved source (may be null while the
  // answer is still streaming and the sources event hasn't landed yet).
  const items = nums.map((n) => ({ n, source: ctx?.sources?.[n - 1] ?? null }));
  return (
    <CitationChip
      key={key}
      items={items}
      onActivate={(n) => ctx?.onCite(n)}
    />
  );
};

// Split a text node first on the <br> sentinel, then parse citation runs within
// each segment, interleaving real <br/> elements between segments.
const parseCitations = (text, citeCtx) => {
  const segments = text.split(BR_SENTINEL);
  return segments.flatMap((segment, segIdx) => {
    const parts = segment
      .split(CITE_RUN_RE)
      .map((part, i) => renderCiteRun(part, `${segIdx}-${i}`, citeCtx));
    return segIdx < segments.length - 1
      ? [...parts, <br key={`br-${segIdx}`} />]
      : parts;
  });
};

const injectCitations = (children, citeCtx) => {
  if (Array.isArray(children))
    return children.map((child) =>
      typeof child === "string" ? parseCitations(child, citeCtx) : child,
    );
  if (typeof children === "string") return parseCitations(children, citeCtx);
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

const makeMdComponents = (citeCtx) => ({
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-ink text-sm">
      {injectCitations(children, citeCtx)}
    </p>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{injectCitations(children, citeCtx)}</li>
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
      {injectCitations(children, citeCtx)}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-rule px-3 py-1.5 align-top text-ink">
      {injectCitations(children, citeCtx)}
    </td>
  ),
});

// ─── Static plugin arrays ─────────────────────────────────────────────────────

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [[rehypeHighlight, { detect: true, ignoreMissing: true }]];

// ─── MarkdownRenderer ─────────────────────────────────────────────────────────

/**
 * Renders markdown text with syntax highlighting and rich citation chips
 * ([1], [2] → a hover-previewed pill; click calls onCite with the 1-based
 * index). The `sources` array powers each chip's preview card.
 *
 * Memoized: only re-renders when `text` or `sources` change. The `onCite`
 * callback and `sources` are kept in a ref so the components map is created
 * once and never invalidated.
 */
const MarkdownRenderer = memo(({ text, sources, onCite }) => {
  const citeCtx = useRef({ onCite, sources });
  citeCtx.current = useMemo(
    () => ({ onCite: (n) => onCite?.(n), sources }),
    [onCite, sources],
  );

  const components = useMemo(() => makeMdComponents(citeCtx), []);

  // Swap literal <br> tags for a sentinel before parsing; the components map
  // turns the sentinel into real <br/> elements (see replaceBrTags above).
  const source = useMemo(() => replaceBrTags(text), [text]);

  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {source}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
