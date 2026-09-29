import { useMemo } from "react";
import { useAiPostsStore } from "@/lib/gbp/ai-posts";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** AI posts limited to the GBP profiles (locations) in the current workspace. */
export function useWorkspaceAiPosts() {
  const workspace = useWorkspace();
  const store = useAiPostsStore();
  const locations = workspace.activeClient
    ? workspace.locations.filter((l) => !l.clientId || l.clientId === workspace.activeClient?.id)
    : workspace.locations;

  const locationIds = locations.map((l) => l.id).join("|");
  const posts = useMemo(() => {
    const ids = new Set(locationIds.split("|"));
    return store.posts.filter((p) => ids.has(p.locationId));
  }, [store.posts, locationIds]);

  return {
    status: workspace.status === "loading" ? "loading" : store.status,
    posts,
    allPosts: store.posts,
    schedule: store.schedule,
    locations,
    activeLocation: workspace.activeLocation,
  } as const;
}
