import { hasPermission, resolveAccessProfile, toRole, type AccessProfile, type Permission } from "@/lib/mypageseo/access";
import { useOrganizationInfo } from "@/lib/mypageseo/organization-info";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Access for the signed-in user, for gating routes, menu items and actions. */
export function useAccess(): AccessProfile & { can: (permission: Permission) => boolean } {
  const { organization } = useWorkspace();
  // Until `GET organization` answers, a member is treated as unlimited; the backend stays authoritative.
  const info = useOrganizationInfo();
  const profile = resolveAccessProfile(organization?.accountType ?? "business", toRole(organization?.role), info.data?.restricted ?? false);
  return { ...profile, can: (permission) => hasPermission(profile, permission) };
}

/** False for a client_user: hide write buttons rather than letting the call fail with 403 `read_only`. */
export function useCanEdit(): boolean {
  return useAccess().can("workspace.edit");
}
