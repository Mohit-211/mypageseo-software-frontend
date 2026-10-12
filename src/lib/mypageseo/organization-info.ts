import { useQuery } from "@tanstack/react-query";
import { getOrganization } from "@/api";
import { useWorkspace } from "./workspace";

export const organizationInfoKey = (organizationId: string | null) => ["organization", "info", organizationId] as const;

/** `GET organization`: the caller's role, and (Phase 21) whether it's limited to some clients. */
export function useOrganizationInfo() {
  const { organization } = useWorkspace();
  return useQuery({
    queryKey: organizationInfoKey(organization?.id ?? null),
    queryFn: ({ signal }) => getOrganization(signal),
    enabled: Boolean(organization),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
