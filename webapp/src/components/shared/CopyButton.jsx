import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// Compact copy control that confirms with a check + label for a couple seconds.
// `getText` is called lazily on click so callers can pass freshly-derived text
// (e.g. the raw markdown of a still-streaming answer) without recomputing on
// every render. `label`/`copiedLabel` are optional; omit for an icon-only button.
const CopyButton = ({
  getText,
  label,
  copiedLabel = "Copied",
  size = 14,
  className = "",
  title = "Copy",
}) => {
  const { copied, copy } = useCopyToClipboard();

  const handleClick = () => {
    const text = typeof getText === "function" ? getText() : getText;
    copy(text);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? copiedLabel : title}
      aria-label={copied ? copiedLabel : title}
      className={`inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider transition-colors ${
        copied ? "text-brass" : "text-muted hover:text-ink"
      } ${className}`}
    >
      {copied ? (
        <Check size={size} aria-hidden="true" />
      ) : (
        <Copy size={size} aria-hidden="true" />
      )}
      {label != null ? <span>{copied ? copiedLabel : label}</span> : null}
    </button>
  );
};

export default CopyButton;
