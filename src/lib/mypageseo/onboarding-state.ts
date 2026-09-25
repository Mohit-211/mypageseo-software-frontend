/**
 * Onboarding session state (frontend only).
 *
 * The onboarding backend is not connected to this frontend. To keep the setup
 * flow usable end to end — resumable between steps and across refreshes — the
 * in-progress answers are kept in a small local store backed by
 * `localStorage`. Nothing here talks to an API, and the shape mirrors
 * `OnboardingProgress` so the store can be swapped for backend reads/writes
 * without touching the screens.
 */

import { useSyncExternalStore } from "react";
import type { OnboardingProgress, OnboardingStepId } from "./onboarding";
import { DEMO_ONBOARDING } from "./demo/onboarding";

export type OnboardingSession = {
  accountType: "business" | "agency";
  /** Step the user is currently on. */
  step: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  progress: OnboardingProgress;
  /** ISO timestamp set when the user finished setup. */
  finishedAt: string | null;
};

const STORAGE_KEY = "mypageseo.onboarding.v1";

let session: OnboardingSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function read(): OnboardingSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingSession;
    if (!parsed || (parsed.accountType !== "business" && parsed.accountType !== "agency")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(next: OnboardingSession | null) {
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — the flow still works for this page view */
  }
}

/** Lazily loads the stored session on first access. */
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  session = read();
}

export function getOnboardingSession(): OnboardingSession | null {
  ensureLoaded();
  return session;
}

export function setOnboardingSession(next: OnboardingSession | null) {
  ensureLoaded();
  session = next;
  persist(next);
  emit();
}

export function updateOnboardingSession(
  patch: (current: OnboardingSession) => OnboardingSession,
) {
  const current = getOnboardingSession();
  if (!current) return;
  setOnboardingSession(patch(current));
}

/** Creates a fresh session, seeded with what signup already collected. */
export function startOnboardingSession(input: {
  accountType: "business" | "agency";
  organizationName?: string;
  country?: string;
}): OnboardingSession {
  const base = DEMO_ONBOARDING(input.accountType);
  const progress: OnboardingProgress =
    base.status === "ready"
      ? {
          ...base.progress,
          organization: {
            ...base.progress.organization,
            organizationName: input.organizationName?.trim() || base.progress.organization.organizationName,
            country: input.country || base.progress.organization.country,
          },
        }
      : ({} as OnboardingProgress);

  const next: OnboardingSession = {
    accountType: input.accountType,
    step: "organization",
    completedSteps: [],
    progress,
    finishedAt: null,
  };
  setOnboardingSession(next);
  return next;
}

export function clearOnboardingSession() {
  setOnboardingSession(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive read of the stored session. */
export function useOnboardingSession(): OnboardingSession | null {
  return useSyncExternalStore(subscribe, getOnboardingSession);
}
