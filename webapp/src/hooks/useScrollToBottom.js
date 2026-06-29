import { useCallback, useEffect, useRef } from "react";

// Pixel slack allowed when deciding whether the viewport is "at the bottom".
// Browsers report fractional scrollHeight/scrollTop/clientHeight, so an exact
// equality check (scrollTop + clientHeight === scrollHeight) is never reliable.
const BOTTOM_EPSILON = 2;

// How many animation frames to keep re-pinning after a scroll request. Async
// content (markdown, syntax-highlighted code blocks, images, the sources ledger
// that measures its own height) settles over several frames; a single
// scrollTop assignment lands at the bottom-as-it-was-then and is left behind
// when that content grows. Re-pinning each frame for a short window absorbs it.
const SETTLE_FRAMES = 12;

// Walk up from `node` to the nearest scrollable ancestor — the element that
// actually owns the conversation's scrollbar. Returns the documentElement as a
// last resort so callers always get a usable target.
const findScrollParent = (node) => {
  let el = node?.parentElement;
  while (el) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const scrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (scrollable && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const isAtBottom = (el) =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_EPSILON;

// Keep a scroll container pinned to its true bottom.
//
// `anchorRef` must point at a sentinel element rendered as the last child of the
// scrollable content (so its scrollable ancestor is the conversation viewport).
//
// Returns `scrollToBottom(behavior)`: assigns scrollTop = scrollHeight directly
// (not scrollIntoView, which stops at the sentinel and is thrown off by the
// sticky composer overlapping it), then re-pins across SETTLE_FRAMES frames
// until `scrollTop + clientHeight >= scrollHeight`, so late layout growth can't
// strand the viewport partway down.
//
// While `enabled` is true a ResizeObserver watches the content for height
// changes (image loads, expanding code blocks) and re-pins — but only if the
// user was already at the bottom, so it never yanks someone who scrolled up.
export function useScrollToBottom(anchorRef, { enabled = true } = {}) {
  const rafRef = useRef(0);
  // Whether the viewport was at the bottom *before* the latest layout change.
  // Updated on user scroll and after each programmatic pin, then consulted by
  // the ResizeObserver — once content grows the live measurement already reads
  // "not at bottom", so we need the remembered state to know if we should chase
  // the new bottom or leave a deliberately-scrolled-up user alone.
  const pinnedRef = useRef(true);

  const scrollToBottom = useCallback(
    (behavior = "auto") => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const container = findScrollParent(anchor);
      if (!container) return;

      cancelAnimationFrame(rafRef.current);

      // Smooth scrolling animates over time and fights per-frame re-pinning, so
      // only the first jump honors `behavior`; the settle pass is instant.
      const jump = (smooth) => {
        if (smooth) {
          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      };

      jump(behavior === "smooth");

      let frame = 0;
      const settle = () => {
        if (frame >= SETTLE_FRAMES || isAtBottom(container)) {
          // Final correction in case the last growth landed this same frame.
          if (!isAtBottom(container)) container.scrollTop = container.scrollHeight;
          pinnedRef.current = true;
          return;
        }
        frame += 1;
        container.scrollTop = container.scrollHeight;
        rafRef.current = requestAnimationFrame(settle);
      };
      pinnedRef.current = true;
      rafRef.current = requestAnimationFrame(settle);
    },
    [anchorRef],
  );

  // Track whether the user is currently at the bottom so the ResizeObserver can
  // tell a genuine "follow new content" from a deliberate scroll-up.
  useEffect(() => {
    if (!enabled) return undefined;
    const anchor = anchorRef.current;
    if (!anchor) return undefined;
    const container = findScrollParent(anchor);
    if (!container) return undefined;
    const onScroll = () => {
      pinnedRef.current = isAtBottom(container);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [anchorRef, enabled]);

  // Re-pin when async content changes the container height after the initial
  // scroll, so the viewport tracks the latest message as it grows.
  useEffect(() => {
    if (!enabled) return undefined;
    const anchor = anchorRef.current;
    if (!anchor || typeof ResizeObserver === "undefined") return undefined;
    const container = findScrollParent(anchor);
    const content = container?.firstElementChild ?? anchor.parentElement;
    if (!container || !content) return undefined;

    const observer = new ResizeObserver(() => {
      // Chase the new bottom only if the user was pinned before this growth.
      if (pinnedRef.current && !isAtBottom(container)) {
        container.scrollTop = container.scrollHeight;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [anchorRef, enabled]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return scrollToBottom;
}
