import { useEffect, useState } from "react";

// Subscribe to a CSS media query and re-render when it flips. Used to decide
// whether the sidebar behaves as an off-canvas drawer (mobile) or a persistent
// rail (tablet+). SSR-safe: defaults to false when `window` is unavailable.
export const useMediaQuery = (query) => {
  const getMatch = () =>
    typeof window !== "undefined" && window.matchMedia(query).matches;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    // Sync once in case the query (or its match) changed between the initial
    // render and this effect firing — a known race for matchMedia subscriptions.
    // Guarded so we only set on a real diff; safe and intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches((prev) => (prev === mql.matches ? prev : mql.matches));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};
