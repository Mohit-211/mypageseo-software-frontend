import { useCallback, useEffect, useState } from "react";
import type { ClientPageData, ClientReportType } from "./types";

/**
 * Where the page lives: `/<token>` on the neutral domain, `/w/<token>` on the API host. Every call is
 * relative to it, so the same build works on both.
 */
export const pageBase = (): string => window.location.pathname.replace(/\/+$/, "");

/** `?e=<key>` for an earlier edition, nothing for the latest. */
const editionQuery = (key: string | null) => (key ? `?e=${encodeURIComponent(key)}` : "");

export const pdfUrl = (type: ClientReportType, edition: string | null) => `${pageBase()}/pdf/${type}${editionQuery(edition)}`;

export const editionFromUrl = (): string | null => new URLSearchParams(window.location.search).get("e");

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: ClientPageData }
  /** Unknown, rotated or revoked link (the backend answers one neutral 404 for all of them). */
  | { status: "not_found" }
  | { status: "rate_limited" }
  | { status: "error" };

async function fetchPage(edition: string | null, signal: AbortSignal): Promise<LoadState> {
  // Sample data at `/demo` in development; the check is inlined so production builds drop the fixture.
  if (import.meta.env.DEV && pageBase().endsWith("/demo")) {
    const { demoPage } = await import("./demo-data");
    return { status: "ready", data: demoPage(edition) };
  }
  const response = await fetch(`${pageBase()}/data${editionQuery(edition)}`, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 429) return { status: "rate_limited" };
  if (!response.ok) return { status: "error" };
  const body = (await response.json()) as ClientPageData | { data: ClientPageData };
  return { status: "ready", data: "branding" in body ? body : body.data };
}

/** The page's data for the edition in the URL; `open(key)` switches edition without a reload. */
export function useClientPage() {
  const [edition, setEdition] = useState<string | null>(editionFromUrl);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(edition, controller.signal)
      .then(setState)
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [edition, attempt]);

  useEffect(() => {
    const onPop = () => setEdition(editionFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((key: string | null) => {
    const url = `${pageBase()}${editionQuery(key)}${window.location.hash}`;
    window.history.pushState(null, "", url);
    setEdition(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, edition, open, retry };
}
