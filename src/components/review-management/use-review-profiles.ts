import { useWorkspace } from "@/lib/mypageseo/workspace";

/** GBP profiles (locations) in the current workspace, with the selected one shared across the app. */
export function useReviewProfiles() {
  const workspace = useWorkspace();
  const locations = workspace.activeClient
    ? workspace.locations.filter((l) => !l.clientId || l.clientId === workspace.activeClient?.id)
    : workspace.locations;
  const active = locations.find((l) => l.id === workspace.activeLocation?.id) ?? locations[0] ?? null;
  const ready = workspace.status !== "loading";

  return {
    ready,
    locations,
    locationId: ready ? (active?.id ?? null) : null,
    setLocationId: workspace.setActiveLocationId,
  };
}
