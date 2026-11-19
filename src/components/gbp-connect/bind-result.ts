/**
 * Binding a picked Business Profile (`POST /gbp/picks/:pickId/bind`). For a location that was already set up (a
 * Places location linked to its Google profile), the answer's `gbp_sync` (2026-11-17) says its first Google sync
 * is queued: the profile and the reviews load in the background (the location's pages show it running). It is
 * `{ error }` when the sync couldn't be queued (the bind still worked), and null during setup (the setup's own
 * first sync follows).
 */
import { bindGbpPick, type GbpBindResult } from "@/api";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { runLocationAction } from "@/lib/locations/location-actions";

export type BindSync = NonNullable<GbpBindResult["gbp_sync"]>;

/** Runs a Bind or a Places add (as `runLocationAction`), keeping what a Bind says about the first Google sync. */
export async function addOrBindLocation(action: PendingLocationAction): Promise<{ locationId: string; gbpSync: BindSync | null }> {
  if (action.kind === "bind") {
    const result = await bindGbpPick(action.pickId, action.clientId);
    return { locationId: result.location.location_id, gbpSync: result.gbp_sync ?? null };
  }
  return { locationId: await runLocationAction(action), gbpSync: null };
}

/** The toast's words after a Bind that started (or couldn't start) a location's first sync; null otherwise. */
export function bindSyncText(title: string, gbpSync: BindSync | null): { title: string; description: string } | null {
  if (!gbpSync) return null;
  if ("error" in gbpSync) return { title: `${title} is connected to Google`, description: "Its profile and reviews load at the next sync." };
  return { title: `${title} is connected to Google`, description: "Loading the profile and reviews in the background." };
}
