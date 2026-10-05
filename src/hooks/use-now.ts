import { useEffect, useState } from "react";

/**
 * The current time in ms, updated every `intervalMs` (default a minute), so
 * time-based UI re-renders without reading the clock during render.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
