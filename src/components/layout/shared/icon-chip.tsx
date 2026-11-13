import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_TONE_CLASSES, type ModuleTone, type StatusTone } from "@/components/layout/shared/module-tone";

const SIZE_CLASSES = {
  sm: { box: "size-7 rounded-md", icon: "size-3.5" },
  md: { box: "size-9 rounded-lg", icon: "size-[18px]" },
  lg: { box: "size-10 rounded-xl", icon: "size-5" },
} as const;

// Status chips (Published, Needs attention…) share the module chips' shape: a tinted surface, the
// status colour on the icon (>= 3:1) and a hairline ring. Written out in full for Tailwind.
const STATUS_CHIP_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border-strong",
  success: "bg-success-surface text-success ring-1 ring-inset ring-success/20",
  warning: "bg-warning-surface text-warning ring-1 ring-inset ring-warning/30",
  critical: "bg-critical-surface text-critical ring-1 ring-inset ring-critical/20",
  info: "bg-info-surface text-info ring-1 ring-inset ring-info/20",
  brand: "bg-brand-tint text-primary ring-1 ring-inset ring-primary/20",
  ai: "bg-ai-surface text-ai ring-1 ring-inset ring-ai/20",
};

/**
 * A module icon in a soft tinted square: the visual anchor of page headers, overview tiles and
 * empty states. Decorative (hidden from assistive tech): the text next to it carries the meaning.
 *
 * `tone` is the module identity (Keywords blue, Reviews ochre…). For a tile that reports a status
 * (Published, Scheduled, Needs attention) pass `statusTone` instead; it wins over `tone`.
 */
export function IconChip({
  icon: Icon,
  tone = "brand",
  statusTone,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: ModuleTone;
  statusTone?: StatusTone | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = SIZE_CLASSES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        sizes.box,
        statusTone ? STATUS_CHIP_CLASSES[statusTone] : MODULE_TONE_CLASSES[tone].chip,
        className,
      )}
    >
      <Icon className={sizes.icon} strokeWidth={2} />
    </span>
  );
}
