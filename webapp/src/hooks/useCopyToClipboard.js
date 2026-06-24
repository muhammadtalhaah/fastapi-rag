import { useCallback, useRef, useState } from "react";

// Copies text to the clipboard and exposes a short-lived `copied` flag so the UI
// can show "Copied" feedback that resets itself. `resetMs` controls how long the
// confirmed state lingers before flipping back to idle.
export function useCopyToClipboard({ resetMs = 2000 } = {}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const copy = useCallback(
    async (text) => {
      if (text == null) return false;
      try {
        await navigator.clipboard.writeText(String(text));
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
        return true;
      } catch {
        // Clipboard can fail on insecure origins or when permission is denied;
        // surface the failure to the caller rather than faking success.
        setCopied(false);
        return false;
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
