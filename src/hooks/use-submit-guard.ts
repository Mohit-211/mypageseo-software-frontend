import { useCallback, useRef, useState } from "react";

/**
 * Prevents duplicate submissions: while a run is in flight every further call
 * is ignored, so a double click or a repeated Enter press cannot submit twice.
 */
export function useSubmitGuard() {
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    try {
      await action();
      return true;
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}
