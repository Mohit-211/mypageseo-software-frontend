import { getBrandingLogo, type Branding } from "@/api";
import { usePrivateLogoUrl } from "./branding";
import { BRANDING_KEY } from "./client-links";

/** The organization's logo as an object URL (it's private, so it's fetched with the session). */
export function useBrandLogoUrl(branding: Branding | undefined): string | null {
  return usePrivateLogoUrl(BRANDING_KEY, branding?.logo ? getBrandingLogo : null, [branding?.logo?.bytes ?? null, branding?.updated_at ?? null]);
}
