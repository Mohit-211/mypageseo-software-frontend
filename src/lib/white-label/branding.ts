import { useQuery } from "@tanstack/react-query";

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const WEBSITE_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const LOGO_MAX_BYTES = 512 * 1024;

/** Reads a chosen logo as a data URL, or rejects with the message to show. */
export function readLogoFile(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) return Promise.reject(new Error("Use a PNG or JPEG logo."));
  if (file.size > LOGO_MAX_BYTES) return Promise.reject(new Error("The logo must be 512 KB or smaller."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The logo couldn't be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * A private logo as an object URL (it needs the session, so it can't be an <img src> to the API).
 * `version` changes when the logo does, so a new one is fetched.
 */
export function usePrivateLogoUrl(key: readonly unknown[], fetchLogo: ((signal: AbortSignal) => Promise<Blob>) | null, version: unknown) {
  const logo = useQuery({
    queryKey: [...key, "logo", version],
    queryFn: async ({ signal }) => URL.createObjectURL(await fetchLogo!(signal)),
    enabled: Boolean(fetchLogo),
    retry: false,
    staleTime: Infinity,
  });
  return fetchLogo ? (logo.data ?? null) : null;
}
