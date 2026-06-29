import { memo, useState } from "react";
import { Popover } from "antd";
import { ArrowLeft, ArrowRight, FileText, Globe } from "lucide-react";

// ─── Citation chip ──────────────────────────────────────────────────────────
//
// Renders a *run* of inline citations (`[1]`, `[1][2]`, …) as a single labeled
// source pill — favicon + source name + a "+N" overflow when the run cites more
// than one source. Hovering opens a popover card with the source's title and
// snippet and a 1/N pager to flip between the grouped sources.
//
// Click behavior, per source kind:
//   • web source → opens its URL in a new tab
//   • document source (no URL) → opens the Sources drawer via `onActivate`
//
// All data comes from the `items` prop (`[{ n, source }]`) already threaded
// down from the message turn — no extra fetch. A citation number is 1-based.

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

const isWebSource = (s) => s?.type === "web";

// The display name for a web source: the backend-derived publisher name when
// present (e.g. "Abc"), else the bare hostname as a fallback.
const webName = (source) => source.sourceName || hostnameOf(source.url);

// Format a provider-supplied date string (ISO-ish) as a short, readable label
// like "24 Jun 2026". Returns "" for missing/unparseable values so callers can
// simply skip rendering when there's nothing to show.
const formatDate = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Short, human label for a source — the publisher name (web) or the document
// filename. Used on the pill face and the popover header.
const labelOf = (source) => {
  if (!source) return "Source";
  return isWebSource(source) ? webName(source) : source.filename || "Document";
};

// ─── Favicon ──────────────────────────────────────────────────────────────────

const Favicon = memo(({ origin, size = 14 }) => {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <Globe size={size} aria-hidden="true" className="shrink-0 text-muted" />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${origin}&sz=32`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
});
Favicon.displayName = "Favicon";

// Small icon for a source — favicon for web, file glyph for documents.
const SourceIcon = memo(({ source, size = 14 }) =>
  isWebSource(source) ? (
    <Favicon origin={originOf(source.url)} size={size} />
  ) : (
    <FileText size={size} aria-hidden="true" className="shrink-0 text-muted" />
  ),
);
SourceIcon.displayName = "SourceIcon";

// ─── Popover card ───────────────────────────────────────────────────────────

// The hover card. Whole body is a button: clicking opens the active source
// (web → new tab, doc → drawer). A 1/N pager flips between grouped sources
// without dismissing the popover.
const CitationCard = ({ items, onActivate }) => {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, items.length - 1);
  const { n, source } = items[safeIdx];
  const multi = items.length > 1;

  // The header already shows the source identity (domain / filename), so the
  // body heading only carries NEW information: a web article's title. For
  // documents (whose only "title" is the filename, already in the header) the
  // heading is dropped and the passage label leads instead.
  const heading = source
    ? isWebSource(source)
      ? source.title || hostnameOf(source.url)
      : null
    : `Source ${n}`;
  const sub =
    source && !isWebSource(source) && source.chunkIndex != null
      ? `passage ${source.chunkIndex}`
      : null;
  const dateLabel =
    source && isWebSource(source) ? formatDate(source.publishedDate) : "";
  const body = source ? (isWebSource(source) ? source.snippet : source.text) : null;

  const step = (delta) => (e) => {
    e.stopPropagation();
    setIdx((i) => (i + delta + items.length) % items.length);
  };

  const arrowClass =
    "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink";

  return (
    <div className="w-72 max-w-[80vw] bg-surface border border-muted/20">
      {/* Header: source kind + pager */}
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex items-center gap-1.5 truncate font-mono text-xs tracking-wider text-muted">
          <SourceIcon source={source} size={13} />
          <div className="truncate">
            {source
              ? isWebSource(source)
                ? webName(source)
                : source.filename || "Document"
              : "Citation"}
          </div>
        </div>
        {multi ? (
          <span className="flex shrink-0 items-center gap-0.5 font-mono text-xs text-muted">
            <button
              type="button"
              onClick={step(-1)}
              aria-label="Previous source"
              className={arrowClass}
            >
              <ArrowLeft size={13} aria-hidden="true" />
            </button>
            <span className="tabular-nums">
              {safeIdx + 1}/{items.length}
            </span>
            <button
              type="button"
              onClick={step(1)}
              aria-label="Next source"
              className={arrowClass}
            >
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      {/* Body: click to open the active source. */}
      <button
        type="button"
        onClick={() => onActivate(source, n)}
        className="block w-full border-t border-rule/60 bg-ground p-2 text-left transition-colors hover:bg-ground/70"
      >
        {heading ? (
          <h3 className="line-clamp-2 text-sm font-semibold text-ink">{heading}</h3>
        ) : null}
        {sub ? (
          <span className="block font-mono text-[0.65rem] text-muted">{sub}</span>
        ) : null}
        {dateLabel ? (
          <span className="mt-0.5 block font-mono text-[0.65rem] text-muted/80">
            {dateLabel}
          </span>
        ) : null}
        {body ? (
          <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted/90">
            {body}
          </span>
        ) : null}
        <span className="mt-2 block font-mono text-[0.6rem] uppercase tracking-wider text-brass/80">
          {source && isWebSource(source) ? "Open source ↗" : "Open in sources"}
        </span>
      </button>
    </div>
  );
};

// ─── Chip ─────────────────────────────────────────────────────────────────────

const CitationChip = memo(({ items, onActivate }) => {
  // Open a source: web → new tab, document → drawer (via the cited number).
  const activate = (source, n) => {
    if (isWebSource(source) && source.url) {
      window.open(source.url, "_blank", "noopener,noreferrer");
    } else {
      onActivate(n);
    }
  };

  const lead = items[0]?.source ?? null;
  const overflow = items.length - 1;
  const label = labelOf(lead);

  const pill = (
    <button
      type="button"
      onClick={() => activate(lead, items[0].n)}
      className="mx-0.5 inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-rule bg-surface/70 py-0.5 pl-1 pr-2 align-baseline text-[0.7rem] font-medium leading-none text-muted transition-colors hover:border-brass/50 hover:text-ink"
      aria-label={
        overflow > 0 ? `Sources: ${label} and ${overflow} more` : `Source: ${label}`
      }
    >
      <SourceIcon source={lead} size={12} />
      <span className="truncate">{label}</span>
      {overflow > 0 ? (
        <span className="shrink-0 font-mono text-muted/80">+{overflow}</span>
      ) : null}
    </button>
  );

  return (
    <Popover
      fresh
      destroyOnHidden
      trigger="hover"
      placement="bottom"
      mouseEnterDelay={0.15}
      mouseLeaveDelay={0.1}
      color="rgb(var(--elevated))"
      styles={{ container: { padding: 0 } }}
      content={<CitationCard items={items} onActivate={activate} />}
    >
      {pill}
    </Popover>
  );
});
CitationChip.displayName = "CitationChip";

export default CitationChip;
