import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { formatScore } from "@/utils/format";

// Group flat source chunks by document, keeping the highest score per doc.
function groupByDocument(sources) {
  const map = new Map();
  for (const source of sources) {
    const key = source.documentId;
    if (!map.has(key)) {
      map.set(key, { documentId: key, filename: source.filename, topScore: source.score, chunks: [] });
    }
    const doc = map.get(key);
    if (source.score > doc.topScore) doc.topScore = source.score;
    doc.chunks.push(source);
  }
  // Sort docs by top score desc, chunks within each doc by chunk index
  return Array.from(map.values())
    .sort((a, b) => b.topScore - a.topScore)
    .map((doc) => ({
      ...doc,
      chunks: [...doc.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex),
    }));
}

const SourcesLedger = ({ sources }) => {
  if (!sources?.length) return null;

  const docs = groupByDocument(sources);
  const totalChunks = sources.length;

  return (
    <div className="mt-4 border border-rule bg-ground/40">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Sources
        </span>
        <span className="font-mono text-xs text-muted">
          {docs.length} {docs.length === 1 ? "document" : "documents"} · {totalChunks} {totalChunks === 1 ? "passage" : "passages"}
        </span>
      </div>
      <ul>
        {docs.map((doc, i) => (
          <DocRow key={doc.documentId} doc={doc} last={i === docs.length - 1} />
        ))}
      </ul>
    </div>
  );
};

const DocRow = ({ doc, last }) => {
  const [open, setOpen] = useState(false);

  return (
    <li className={last ? "" : "border-b border-rule"}>
      {/* Document header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
        <FileText size={14} aria-hidden="true" className="shrink-0 text-muted" />
        <span className="flex-1 truncate text-sm text-ink">{doc.filename}</span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {doc.chunks.length} {doc.chunks.length === 1 ? "passage" : "passages"}
        </span>
        <span className="shrink-0 font-mono text-xs text-retrieval">
          {formatScore(doc.topScore)}
        </span>
      </button>

      {/* Expanded chunk list */}
      {open ? (
        <ul className="border-t border-rule/60">
          {doc.chunks.map((chunk, i) => (
            <ChunkRow key={chunk.key} chunk={chunk} last={i === doc.chunks.length - 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

const ChunkRow = ({ chunk, last }) => {
  const [open, setOpen] = useState(false);

  return (
    <li className={`bg-ground/60 ${last ? "" : "border-b border-rule/40"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-2.5 pl-10 pr-4 text-left transition-colors hover:bg-surface/40"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className={`shrink-0 text-muted/60 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="shrink-0 font-mono text-xs text-brass/80">
          {chunk.callNumber}
        </span>
        <span className="flex-1 truncate font-mono text-xs text-muted">
          passage {chunk.chunkIndex}
        </span>
        <span className="shrink-0 font-mono text-xs text-retrieval/80">
          {formatScore(chunk.score)}
        </span>
      </button>
      {open ? (
        <div className="border-t border-rule/40 bg-ground/80 px-4 py-3 pl-14">
          <p className="font-mono text-xs leading-relaxed text-muted">
            {chunk.text}
          </p>
        </div>
      ) : null}
    </li>
  );
};

export default SourcesLedger;
