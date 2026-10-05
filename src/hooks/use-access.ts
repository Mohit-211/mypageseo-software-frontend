import { hasPermission, resolveAccessProfile, type AccessProfile, type Permission } from "@/lib/mypageseo/access";
import { useAccountType } from "@/lib/mypageseo/workspace";

/** Access for the signed-in user, for gating routes, menu items and actions. */
export function useAccess(): AccessProfile & { can: (permission: Permission) => boolean } {
  const accountType = useAccountType();
  const profile = resolveAccessProfile(accountType);
  return { ...profile, can: (permission) => hasPermission(profile, permission) };
}
