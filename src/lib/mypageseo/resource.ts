/**
 * Shared asynchronous read seam for every Mypageseo screen.
 *
 * Why this exists
 * ---------------
 * Screens must consume data the same way whether it arrives from the real
 * backend or from the frontend demo layer. Every data module exposes an async
 * `load*` function that performs the real read and falls back to demo data only
 * when no real value is available (`withDemoFallback`). Components subscribe
 * through `useResource`, so they already render loading, success and failure
 * states before the backend is connected.
 *
 * Switching to the real backend means replacing the `real` value inside each
 * module's loader. No visual component changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyError, failureCopy, type Failure } from "./errors";

export type Resource<T> =
  | { status: "loading"; data: null; failure: null }
  | { status: "success"; data: T; failure: null }
  | { status: "error"; data: null; failure: Failure };

export type ResourceResult<T> = Resource<T> & { retry: () => void; refreshing: boolean };

/** Milliseconds before a read is treated as timed out. */
const DEFAULT_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  status = 408;
  constructor() {
    super("The request timed out");
    this.name = "RequestTimeoutError";
  }
}

/** Rejects if `promise` has not settled before `ms`, so screens never hang. */
export async function withTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Subscribes to an async read.
 *
 * `load` is re-run whenever `deps` change or `retry()` is called. Failures are
 * classified into customer-facing copy; they are never converted into empty
 * success states.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): ResourceResult<T> {
  const [state, setState] = useState<Resource<T>>({ status: "loading", data: null, failure: null });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    const hadData = state.status === "success";
    if (hadData) setRefreshing(true);
    else setState({ status: "loading", data: null, failure: null });

    withTimeout(Promise.resolve().then(() => loadRef.current()))
      .then((data) => {
        if (cancelled) return;
        setState({ status: "success", data, failure: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", data: null, failure: classifyError(error) });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry, refreshing };
}

/** Failure for a read that a disconnected service cannot serve. */
export function serviceUnavailable(): Failure {
  return failureCopy("service_unavailable");
}

/** Simulates read latency for the demo layer only. Removed with the demo layer. */
export function demoLatency(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
