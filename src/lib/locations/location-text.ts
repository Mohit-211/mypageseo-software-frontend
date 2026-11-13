import type { LocationCenter, LocationHeader } from "@/api";

/** A backend text for display, or null when it's missing or a placeholder ("", "n/a"). */
export function knownText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return !text || text.toLowerCase() === "n/a" ? null : text;
}

/**
 * One line for where the business is: "220 King St W, Toronto, ON M5H 1K4", or "Service area ·
 * Toronto, ON" for service-area businesses (whose address comes back as "Service-area business").
 */
export function addressLine(location: Pick<LocationHeader, "address" | "city" | "state" | "zip_code">): string | null {
  const street = knownText(location.address);
  const serviceArea = street?.toLowerCase() === "service-area business";
  const place = [knownText(location.city), knownText(location.state)].filter(Boolean).join(", ");
  if (serviceArea || !street) return [serviceArea ? "Service area" : null, place || null].filter(Boolean).join(" · ") || null;
  return [street, [place, knownText(location.zip_code)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** "harbordental.example/downtown" from "https://www.harbordental.example/downtown/". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** Only http(s) links are opened from the app. */
export function safeHref(url: string | null | undefined): string | null {
  const text = knownText(url);
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Where rankings are measured from, in plain words (null before a center exists). */
export function centerText(center: LocationCenter | null | undefined): string | null {
  if (!center?.source) return null;
  // The business's own pin: its address is already on screen next to this.
  if (center.source === "place") return "Your business address";
  return center.label ?? "The city or ZIP chosen at setup";
}
