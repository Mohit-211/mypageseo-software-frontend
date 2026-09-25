/**
 * Failure classification for the frontend.
 *
 * This does not invent backend error codes: it reads the status or message an
 * error already carries and maps it to the state the interface should show, in
 * language a customer can act on. Technical detail (stack traces, endpoints,
 * database messages) is deliberately never returned from here.
 */

import { isAuthorizationError } from "./access";

export type FailureKind =
  | "not_found"
  | "forbidden"
  | "timeout"
  | "service_unavailable"
  | "network"
  | "unknown";

export type Failure = {
  kind: FailureKind;
  title: string;
  description: string;
  /** Whether retrying the same request is a sensible next step. */
  retryable: boolean;
};

const COPY: Record<FailureKind, Omit<Failure, "kind">> = {
  not_found: {
    title: "This record could not be found",
    description:
      "It may have been removed, or the link you followed may be out of date. Go back to the list to pick another one.",
    retryable: false,
  },
  forbidden: {
    title: "You don't have access to this",
    description:
      "Your account is not allowed to open this. Someone who administers this organization can grant access.",
    retryable: false,
  },
  timeout: {
    title: "This took too long to load",
    description:
      "The request timed out before any data came back. This is usually temporary — try again in a moment.",
    retryable: true,
  },
  service_unavailable: {
    title: "This data is temporarily unavailable",
    description:
      "The service that supplies this data is not responding right now. Nothing has been lost; try again shortly.",
    retryable: true,
  },
  network: {
    title: "Couldn't reach Mypageseo",
    description:
      "The connection dropped while loading this. Check your connection and try again.",
    retryable: true,
  },
  unknown: {
    title: "This data could not be loaded",
    description:
      "Something went wrong while loading this section. The rest of the page still works. Try again, and contact support if it keeps happening.",
    retryable: true,
  },
};

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: number; statusCode?: number };
  return candidate.status ?? candidate.statusCode;
}

export function classifyError(error: unknown): Failure {
  const status = statusOf(error);
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  let kind: FailureKind = "unknown";
  if (status === 404 || /\bnot found\b/i.test(message)) kind = "not_found";
  else if (isAuthorizationError(error)) kind = "forbidden";
  else if (status === 408 || status === 504 || /\btimed? ?out\b/i.test(message)) kind = "timeout";
  else if (status === 503 || status === 502 || /service unavailable|bad gateway/i.test(message))
    kind = "service_unavailable";
  else if (/network|failed to fetch|connection/i.test(message)) kind = "network";

  return { kind, ...COPY[kind] };
}

/** Copy for a failure kind without an error object in hand. */
export function failureCopy(kind: FailureKind): Failure {
  return { kind, ...COPY[kind] };
}
