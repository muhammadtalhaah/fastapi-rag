import { MessageSquare } from "lucide-react";
import { formatDate } from "@/utils/format";

// Split `text` on the query terms and wrap matches in <mark> so the user can see
// why a snippet matched. Terms are escaped for use in a RegExp; matching is
// case-insensitive. Returns an array of React nodes.
function highlight(text, query) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return text;
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "ig"));
  const matcher = new RegExp(`^(?:${terms.join("|")})$`, "i");
  return parts.map((part, i) =>
    matcher.test(part) ? (
      <mark key={i} className="bg-primary/25 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// One conversation in the search results list. Clicking the title opens the
// conversation; clicking a snippet opens it and jumps to that specific message.
// `onSelect(conversationId, messageIndex)` — messageIndex is null for a title hit.
const SearchResultItem = ({ result, query, onSelect }) => (
  <li className="border-b border-rule last:border-b-0">
    <button
      type="button"
      onClick={() => onSelect(result.id, null)}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ground/60"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {result.titleMatch ? highlight(result.title, query) : result.title}
      </span>
      <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
        {formatDate(result.updatedAt)}
      </span>
    </button>

    {result.snippets.length > 0 ? (
      <ul className="pb-2">
        {result.snippets.map((snippet) => (
          <li key={snippet.messageIndex}>
            <button
              type="button"
              onClick={() => onSelect(result.id, snippet.messageIndex)}
              className="flex w-full items-start gap-2 px-4 py-1.5 text-left transition-colors hover:bg-ground/60"
            >
              <MessageSquare
                size={13}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-rule"
              />
              <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted line-clamp-2">
                <span className="mr-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-primary">
                  {snippet.role === "user" ? "You" : "Answer"}
                </span>
                {highlight(snippet.snippet, query)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null}
  </li>
);

export default SearchResultItem;
