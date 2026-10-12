/**
 * Whether the signed-in organization still has setup steps, from the session's
 * `onboarding.completed` (login, verification, invitation). It only decides where
 * to land after sign-in; `/onboarding` reads the real steps from `GET onboarding/state`.
 */
const KEY = "mypageseo.onboarding.pending";

export function setOnboardingPending(pending: boolean) {
  try {
    if (pending) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: sign-in lands on the dashboard, which links to setup.
  }
}

export function isOnboardingPending(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
