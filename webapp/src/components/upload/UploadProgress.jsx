import { FileText } from "lucide-react";

// Shown while bytes are in flight and during the post-upload indexing wait.
// At 100% the server is still chunking + embedding, so the label shifts to
// "Indexing…" rather than implying the work is done.
const UploadProgress = ({ filename, progress }) => {
  const indexing = progress >= 100;

  return (
    <div className="border border-rule bg-surface/40 p-6">
      <div className="flex items-center gap-3">
        <FileText size={18} aria-hidden="true" className="shrink-0 text-muted" />
        <span className="flex-1 truncate text-sm text-ink">{filename}</span>
        <span className="font-mono text-xs text-retrieval">
          {indexing ? "indexing" : `${progress}%`}
        </span>
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden bg-rule"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full bg-retrieval transition-all duration-200 ${
            indexing ? "motion-safe:animate-pulse" : ""
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        {indexing
          ? "Splitting into chunks and computing embeddings…"
          : "Uploading…"}
      </p>
    </div>
  );
};

export default UploadProgress;
