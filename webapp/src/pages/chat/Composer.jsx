import { useState } from "react";
import { ArrowUp } from "lucide-react";

// The ask box. Enter submits; Shift+Enter inserts a newline. Disabled while a
// request is in flight so the single-turn backend isn't double-hit.
const Composer = ({ onSubmit, disabled }) => {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit(value);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 border border-rule bg-surface p-2 focus-within:border-retrieval">
      <label htmlFor="composer" className="sr-only">
        Ask a question about your documents
      </label>
      <textarea
        id="composer"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your documents…"
        className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send question"
        className="flex h-9 w-9 shrink-0 items-center justify-center bg-brass text-ground transition-colors hover:bg-brass/90 disabled:cursor-not-allowed disabled:bg-rule disabled:text-muted"
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default Composer;
