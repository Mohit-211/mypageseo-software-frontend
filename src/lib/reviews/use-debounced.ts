import { useEffect, useState } from "react";

/** `value`, updated only after it has stopped changing for `ms` (the search box), so each keystroke doesn't send a request. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
