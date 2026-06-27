import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, FileText, Globe } from "lucide-react";

// ─── Favicon ──────────────────────────────────────────────────────────────────

// Module-level cache of failed favicon origins so a domain that 404'd once
// doesn't re-attempt (and re-fail) every time its row mounts.
const FAILED_FAVICONS = new Set();

const FaviconImg = memo(({ origin }) => {
  const [failed, setFailed] = useState(() => FAILED_FAVICONS.has(origin));
  if (failed)
    return <Globe size={14} aria-hidden="true" className="shrink-0 text-muted" />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${origin}&sz=16`}
      alt=""
      aria-hidden="true"
      width={14}
      height={14}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-sm"
      onError={() => {
        FAILED_FAVICONS.add(origin);
        setFailed(true);
      }}
    />
  );
});
FaviconImg.displayName = "FaviconImg";

// ─── Derived-data helpers (pure, run once per source set via useMemo) ─────────

const hostnameOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

// Group document chunks by their parent doc, keep the top score, and precompute
// every value a row needs (so render-time work is just reading props).
function buildDocuments(docSources) {
  const map = new Map();
  for (const source of docSources) {
    const key = source.documentId;
    let doc = map.get(key);
    if (!doc) {
      doc = {
        id: `doc:${key}`,
        documentId: key,
        filename: source.filename,
        topScore: source.score,
        chunks: [],
      };
      map.set(key, doc);
    }
    if (source.score > doc.topScore) doc.topScore = source.score;
    doc.chunks.push(source);
  }
  return Array.from(map.values())
    .sort((a, b) => b.topScore - a.topScore)
    .map((doc) => ({
      ...doc,
      chunks: [...doc.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex),
    }));
}

function buildWebSources(webSources) {
  return webSources.map((src, i) => ({
    ...src,
    id: src.key ?? `web:${src.url}:${i}`,
    domain: hostnameOf(src.url),
    origin: originOf(src.url),
  }));
}

// ─── Score bar ────────────────────────────────────────────────────────────────

const ScoreBar = memo(({ score, className = "" }) => {
  const pct = Math.round(score * 100);
  return (
    <span
      className={`relative block h-[3px] w-14 overflow-hidden rounded-full bg-rule/60 ${className}`}
      aria-label={`${pct}% relevance`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-retrieval"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
});
ScoreBar.displayName = "ScoreBar";

// `content-visibility: auto` lets the browser skip layout + paint for rows that
// are scrolled out of view — native, dependency-free virtualization. The
// intrinsic-size hint keeps the scrollbar stable so off-screen rows don't cause
// jumps when they're realized. Applied to every row so the list stays at 60fps
// whether it holds 10 sources or several hundred.
const ROW_CV = { contentVisibility: "auto", containIntrinsicSize: "auto 52px" };

// Hoisted so the chunk-list ledger line doesn't allocate a fresh style object
// on every DocRow render.
const CHUNK_LIST_STYLE = {
  borderTopColor: "rgb(var(--rule) / 0.4)",
  borderLeftColor: "rgb(var(--brass) / 0.25)",
};

// ─── Web source row ───────────────────────────────────────────────────────────

// Each row is memoized and takes a boolean `open` + a stable `onToggle`. When a
// single row toggles, only the open-flag of THAT row changes, so memo skips
// re-rendering every other row — expand/collapse touches one item, not the list.
const WebSourceRow = memo(({ source, open, last, onToggle }) => {
  const toggle = useCallback(() => onToggle(source.id), [onToggle, source.id]);
  return (
    <li className={last ? "" : "border-b border-rule"} style={ROW_CV}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        <FaviconImg origin={source.origin} />
        <span className="flex-1 truncate text-sm text-ink">{source.title}</span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {source.domain}
        </span>
      </button>

      {open && (
        <div className="border-t border-rule/40 bg-ground/80 px-4 py-3 pl-10">
          {source.snippet && (
            <p className="mb-2.5 font-mono text-xs leading-relaxed text-muted">
              {source.snippet}
            </p>
          )}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-brass underline underline-offset-2 hover:text-brass/80"
          >
            Open source ↗
          </a>
        </div>
      )}
    </li>
  );
});
WebSourceRow.displayName = "WebSourceRow";

// ─── Document row ─────────────────────────────────────────────────────────────

const DocRow = memo(({ doc, open, last, onToggle }) => {
  const toggle = useCallback(() => onToggle(doc.id), [onToggle, doc.id]);

  // Chunk-open state is LOCAL to each DocRow. This keeps a chunk toggle scoped
  // to its own document — it can never re-render sibling DocRows — and the Set
  // is only allocated for docs the user actually expands.
  const [openChunks, setOpenChunks] = useState(() => new Set());
  const toggleChunk = useCallback((key) => {
    setOpenChunks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  return (
    <li
      className={last ? "" : "border-b border-rule"}
      style={open ? undefined : ROW_CV}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-muted transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        <FileText
          size={14}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted transition-colors group-hover:text-brass"
        />
        <span className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="truncate text-sm font-medium text-ink leading-snug">
            {doc.filename}
          </span>
          <span className="font-mono text-xs text-muted">
            {doc.chunks.length}{" "}
            {doc.chunks.length === 1 ? "passage" : "passages"}
          </span>
        </span>
        <ScoreBar score={doc.topScore} className="shrink-0 mt-2" />
      </button>

      {open && (
        <ul
          className="relative ml-[2.75rem] border-t border-l"
          style={CHUNK_LIST_STYLE}
          role="list"
          aria-label={`Passages from ${doc.filename}`}
        >
          {doc.chunks.map((chunk, i) => (
            <ChunkRow
              key={chunk.key}
              chunk={chunk}
              open={openChunks.has(chunk.key)}
              last={i === doc.chunks.length - 1}
              onToggle={toggleChunk}
            />
          ))}
        </ul>
      )}
    </li>
  );
});
DocRow.displayName = "DocRow";

// ─── Chunk row ────────────────────────────────────────────────────────────────

const ChunkRow = memo(({ chunk, open, last, onToggle }) => {
  const toggle = useCallback(() => onToggle(chunk.key), [onToggle, chunk.key]);
  return (
    <li className={`bg-ground/50 ${last ? "" : "border-b border-rule/30"}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-2.5 pl-3.5 pr-4 text-left transition-colors hover:bg-surface/40"
      >
        <ChevronDown
          size={11}
          aria-hidden="true"
          className={`shrink-0 text-muted/50 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        <span className="flex-1 font-mono text-xs text-muted">
          passage {chunk.chunkIndex}
        </span>
        <ScoreBar score={chunk.score} className="shrink-0" />
      </button>

      {open && (
        <div className="border-t border-rule/30 bg-ground/80 px-4 py-3 pl-3.5">
          <ClampedText text={chunk.text} />
        </div>
      )}
    </li>
  );
});
ChunkRow.displayName = "ChunkRow";

// ─── Clamped passage text ─────────────────────────────────────────────────────

const CLAMP_LINES = 4;

// Shows the passage capped at CLAMP_LINES lines with a Read more / Read less
// toggle. The toggle is only rendered when the text actually overflows the clamp
// (measured against the rendered height), so short passages have no dangling
// button. Measurement runs once on mount and on resize — never during scroll.
const ClampedText = ({ text }) => {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Compare full content height to the clamped (collapsed) height.
      setOverflows(el.scrollHeight - el.clientHeight > 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <>
      <p
        ref={ref}
        className="font-mono text-xs leading-relaxed text-muted/90"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: CLAMP_LINES,
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 font-mono text-xs text-brass underline underline-offset-2 hover:text-brass/80"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </>
  );
};

// ─── Ledger ───────────────────────────────────────────────────────────────────

const SourcesLedger = ({ sources, hideHeader = false }) => {
  // Derive everything once per `sources` identity. Grouping/sorting/URL parsing
  // are all hoisted out of the render path of individual rows.
  const { webSources, docs, totalChunks } = useMemo(() => {
    const web = sources?.filter((s) => s.type === "web") ?? [];
    const docSrc = sources?.filter((s) => s.type !== "web") ?? [];
    return {
      webSources: buildWebSources(web),
      docs: buildDocuments(docSrc),
      totalChunks: docSrc.length,
    };
  }, [sources]);

  // A single Set of open ids drives expand state for top-level rows (chunk
  // expand state lives locally inside each DocRow). Functional updates keep the
  // callback stable so memoized rows never see a changed `onToggle` prop.
  const [openRows, setOpenRows] = useState(() => new Set());

  const toggleRow = useCallback((id) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  if (!sources?.length) return null;

  const hasWeb = webSources.length > 0;
  const hasDoc = docs.length > 0;

  const summaryDoc = hasDoc
    ? `${docs.length} ${docs.length === 1 ? "document" : "documents"} · ${totalChunks} ${totalChunks === 1 ? "passage" : "passages"}`
    : null;
  const summaryWeb =
    hasWeb && !hasDoc
      ? `${webSources.length} ${webSources.length === 1 ? "web result" : "web results"}`
      : null;

  return (
    <div className={hideHeader ? "" : "mt-4 border border-rule bg-ground/40"}>
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Sources
          </span>
          <span className="font-mono text-xs text-muted">
            {summaryDoc ?? summaryWeb}
          </span>
        </div>
      )}

      {hideHeader && (summaryDoc || summaryWeb) && (
        <div className="px-4 py-2.5 border-b border-rule/40">
          <span className="font-mono text-xs text-muted">
            {summaryDoc ?? summaryWeb}
          </span>
        </div>
      )}

      {hasWeb && (
        <ul className={hasDoc ? "border-b border-rule" : ""}>
          {webSources.map((src, i) => (
            <WebSourceRow
              key={src.id}
              source={src}
              open={openRows.has(src.id)}
              last={i === webSources.length - 1 && !hasDoc}
              onToggle={toggleRow}
            />
          ))}
        </ul>
      )}

      {hasDoc && (
        <ul>
          {docs.map((doc, i) => (
            <DocRow
              key={doc.id}
              doc={doc}
              open={openRows.has(doc.id)}
              last={i === docs.length - 1}
              onToggle={toggleRow}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default memo(SourcesLedger);
