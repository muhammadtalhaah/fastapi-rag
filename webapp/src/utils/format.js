// Generic pure formatters.

export function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Score arrives as a cosine similarity in [0, 1]; show it as a percentage.
export function formatScore(score) {
  if (score == null) return "—";
  return `${(score * 100).toFixed(1)}%`;
}

// Web search snippets arrive as raw scraped markdown: inline image tags,
// link/CDN URLs, pipe-table fragments, and heavy whitespace. Strip the markup
// down to readable prose so the Sources drawer shows a clear, plain summary
// instead of `![Image 6: …](https://api-cdn…)` noise.
export function cleanSnippet(snippet, maxLength = 280) {
  if (!snippet) return "";

  let text = snippet
    // Drop image embeds entirely — they carry no readable meaning.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // Turn [label](url) links into just their label.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Strip any remaining bare URLs.
    .replace(/https?:\/\/\S+/g, " ")
    // Remove markdown table pipes and emphasis/heading markers.
    .replace(/[|>#*_`~]+/g, " ")
    // Drop leftover empty brackets/parens.
    .replace(/[[\]()]+/g, " ")
    // Collapse all whitespace (incl. newlines) to single spaces.
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > maxLength) {
    // Cut at the last word boundary before the limit so we don't split a word.
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }

  return text;
}
