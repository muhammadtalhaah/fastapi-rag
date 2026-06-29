import {
  useRef,
  useState,
  forwardRef,
  useLayoutEffect,
  useImperativeHandle,
} from "react";
import LNG from "@/language";
import ComposerMenu from "./ComposerMenu";
import { ArrowUp, Square } from "lucide-react";
import { AppSelect } from "@/components/shared";
import { DEFAULT_MODEL_ID, MODELS } from "@/config";

// Grow the textarea with its content, from 1 row up to MAX_ROWS, then scroll.
const MAX_ROWS = 10;

// Model picker options, derived once from config. Only one entry today; the
// select scales to however many models become switchable.
const MODEL_OPTIONS = MODELS.map((m) => ({ value: m.id, label: m.name }));

// The ask box. Enter submits; Shift+Enter inserts a newline. Disabled while a
// request is in flight or the chat transport is still connecting.
//
// Layout is a two-row card: the textarea on top, and a toolbar beneath it with
// the "+" action menu (web search toggle) on the left and the active model name
// + send button on the right.
const Composer = forwardRef(function Composer(
  { onSubmit, onStop, isGenerating, disabled, webSearch, onWebSearchChange },
  ref,
) {
  const [value, setValue] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  // Whether the model select's dropdown is open, so the selector can take a
  // distinct background while active for clearer affordance.
  const [modelOpen, setModelOpen] = useState(false);
  // Tracks focus of the textarea specifically (not `focus-within` on the card),
  // so the active ring only lights up for the input itself — clicking the "+"
  // menu or the model select must not make the composer look activated.
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Let the parent focus the input imperatively — e.g. on a new chat or once a
  // response finishes streaming — so the user can start typing without clicking.
  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  );

  // Auto-resize: reset to a single row, then grow to fit content up to a 5-row
  // cap derived from the element's own line-height so it tracks the text styles.
  // Runs on every value change, including the reset to "" after submit.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 0;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

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

  // Clicking anywhere on the card focuses the textarea, except on the toolbar
  // controls (buttons, select). preventDefault keeps the click from stealing
  // focus before we hand it to the textarea.
  const focusOnMouseDown = (e) => {
    if (e.target.closest("button, input, [role='combobox']")) return;
    e.preventDefault();
    textareaRef.current?.focus();
  };

  return (
    <div
      onMouseDown={focusOnMouseDown}
      className={`flex flex-col gap-2 rounded-3xl border bg-surface p-3 transition-colors ${
        isFocused ? "border-retrieval" : "border-rule"
      } cursor-text`}
    >
      <textarea
        rows={1}
        id="composer"
        value={value}
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={LNG.eng.askAnything}
        onChange={(e) => setValue(e.target.value)}
        className="resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <ComposerMenu
          disabled={disabled}
          webSearch={webSearch}
          onWebSearchChange={onWebSearchChange}
        />

        <div className="ml-auto flex items-center gap-2">
          <AppSelect
            size="small"
            value={modelId}
            disabled={disabled}
            placement="topRight"
            variant="borderless"
            onChange={setModelId}
            onOpenChange={setModelOpen}
            className={`composer-model-select p-1 ${
              modelOpen ? "bg-rule" : "hover:bg-rule/50"
            }`}
            options={MODEL_OPTIONS}
            aria-label="Select model"
            popupMatchSelectWidth={false}
          />
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={LNG.eng.stop}
              className="flex p-1.5 rounded-xl shrink-0 items-center justify-center bg-brass text-ground transition-colors hover:bg-brass/90"
            >
              <Square size={20} aria-hidden="true" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              aria-label="Send question"
              disabled={disabled || !value.trim()}
              className="flex p-1.5 rounded-xl shrink-0 items-center justify-center bg-brass text-ground transition-colors hover:bg-brass/90 disabled:cursor-not-allowed disabled:bg-rule disabled:text-muted"
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default Composer;
