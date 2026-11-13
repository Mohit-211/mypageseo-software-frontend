/** "Harbor Dental – Downtown Toronto" → "HD": the first letters of the first two words. */
export function locationInitials(name: string, fallback = "?"): string {
  const words = name
    .split(/[\s–—-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials || fallback;
}
