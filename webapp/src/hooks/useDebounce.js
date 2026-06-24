import { useEffect, useState } from "react";

// Returns `value` delayed by `delay` ms. Each new value resets the timer, so the
// debounced value only settles once input stops changing — used to throttle
// search-as-you-type requests without firing one per keystroke.
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
