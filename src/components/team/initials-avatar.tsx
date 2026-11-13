import { cn } from "@/lib/utils";
import { MODULE_TONE_CLASSES, type ModuleTone } from "@/components/layout/shared/module-tone";

// Friendly tints for people and clients. Violet (AI) and red (critical) are left out on purpose.
const TINTS: ModuleTone[] = ["clients", "keywords", "rankings", "posts", "reputation", "competitors", "citations"];

function initialsOf(name: string, fallback?: string) {
  const source = name.trim() || fallback?.trim() || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

function tintOf(key: string): ModuleTone {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length] ?? "clients";
}

/**
 * Initials in a soft tinted circle, for team members, client users and clients. The tint comes
 * from the name, so the same person keeps the same colour everywhere. Decorative: the name next to
 * it carries the meaning.
 */
export function InitialsAvatar({
  name,
  fallback,
  size = "md",
  square = false,
  className,
}: {
  name: string;
  /** Used when the name is empty (an email address, for example). */
  fallback?: string;
  size?: "sm" | "md" | "lg";
  /** Rounded square instead of a circle (organisations and clients). */
  square?: boolean;
  className?: string;
}) {
  const tone = tintOf(name || fallback || "");
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-semibold",
        size === "sm" ? "size-7 text-xs" : size === "lg" ? "size-12 text-base" : "size-9 text-sm",
        square ? "rounded-lg" : "rounded-full",
        MODULE_TONE_CLASSES[tone].chip,
        className,
      )}
    >
      {initialsOf(name, fallback)}
    </span>
  );
}
