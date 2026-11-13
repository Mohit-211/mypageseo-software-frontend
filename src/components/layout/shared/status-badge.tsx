import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASSES, type StatusTone } from "@/components/layout/shared/module-tone";

/**
 * Status pill for health, sync, issue and workflow states: a soft tinted background, coloured
 * text and a hairline border. Pair the colour with words (and optionally an icon or a dot), so
 * the state never depends on colour alone.
 */
export function StatusBadge({
  tone = "neutral",
  icon: Icon,
  dot = false,
  size = "md",
  children,
  className,
}: {
  tone?: StatusTone;
  icon?: LucideIcon;
  /** A small dot in the status colour before the label. */
  dot?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={tone} size={size} className={className}>
      {dot ? <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_TONE_CLASSES[tone].dot)} /> : null}
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Badge>
  );
}
