import { Trash2, FileText } from "lucide-react";
import { Spinner } from "@/components/shared";
import { formatBytes, formatDate } from "@/utils/format";

// One ledger row. Status is a small teal dot when indexed (queryable) — the
// retrieval accent again signaling "this is live in the index."
const DocumentRow = ({ document, onDelete, isDeleting }) => {
  return (
    <tr className="border-b border-rule last:border-b-0 hover:bg-surface/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate text-sm text-ink">{document.filename}</span>
        </div>
      </td>
      <td className="hidden px-4 py-3 font-mono text-xs text-muted sm_tablet:table-cell">
        {formatDate(document.createdAt)}
      </td>
      <td className="hidden px-4 py-3 font-mono text-xs text-muted lg_tablet:table-cell">
        {formatBytes(document.sizeBytes)}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 font-mono text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              document.status === "indexed" ? "bg-retrieval" : "bg-rule"
            }`}
            aria-hidden="true"
          />
          <span className="text-muted">
            {document.status === "indexed"
              ? `${document.chunkCount} chunks`
              : "empty"}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onDelete(document)}
          disabled={isDeleting}
          aria-label={`Delete ${document.filename}`}
          className="inline-flex items-center justify-center p-1.5 text-muted transition-colors hover:text-danger disabled:cursor-not-allowed"
        >
          {isDeleting ? <Spinner size={15} /> : <Trash2 size={16} aria-hidden="true" />}
        </button>
      </td>
    </tr>
  );
};

export default DocumentRow;
