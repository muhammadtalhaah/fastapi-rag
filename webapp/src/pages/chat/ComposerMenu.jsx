import { useEffect, useId, useRef, useState } from "react";
import { Globe, Info, Plus } from "lucide-react";
import { AppCard, AppSwitch, AppTooltip } from "@/components/shared";
import LNG from "@/language";

const WEB_SEARCH_HELP =
  "When enabled, the assistant can search the web to provide up-to-date " +
  "information and more accurate responses. Disable this if you want responses " +
  "based only on the model's built-in knowledge.";

// Left-side "+" action menu for the composer. Opens a popover above the plus
// button holding the per-conversation Web Search toggle plus a short tooltip
// explaining what it does. Mirrors the AccountMenu popover pattern (Escape /
// outside-click to close, role="menu").
const ComposerMenu = ({ webSearch, onWebSearchChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const labelId = useId();
  const helpId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative cursor-pointer">
      {open ? (
        <AppCard className="w-72 p-3" aria-label="Composer actions">
          <div className="flex items-center gap-2.5">
            <Globe size={16} aria-hidden="true" className="shrink-0 text-muted" />
            <span id={labelId} className="text-sm font-medium text-ink">
              {LNG.eng.webSearch}
            </span>
            <AppTooltip title={WEB_SEARCH_HELP} placement="top">
              <button
                type="button"
                aria-label="About web search"
                className="text-muted transition-colors hover:text-ink focus:outline-none focus-visible:text-ink"
              >
                <Info size={14} aria-hidden="true" />
              </button>
            </AppTooltip>
            <span className="ml-auto">
              <AppSwitch
                size="small"
                checked={webSearch}
                aria-labelledby={labelId}
                aria-describedby={helpId}
                onChange={onWebSearchChange}
              />
            </span>
          </div>
          {/* Description for assistive tech; the visible copy is in the tooltip. */}
          <p id={helpId} className="sr-only">
            {WEB_SEARCH_HELP}
          </p>
        </AppCard>
      ) : null}

      <button
        type="button"
        // Keep the click from shifting focus into the composer textarea — the
        // menu is its own surface, so a tap on "+" shouldn't steal the caret.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="flex rounded-xl h-9 w-9 shrink-0 items-center justify-center border border-transparent text-muted transition-colors hover:border-retrieval hover:text-ink focus:outline-none focus-visible:border-retrieval disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ComposerMenu;
