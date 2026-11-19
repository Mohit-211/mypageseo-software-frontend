/**
 * The approval labels on screen (`src/lib/posts/approval-labels.ts`: why a post waits, why an automatic post is
 * held): each tone has an icon as well as a colour, so a label never depends on colour alone. One look for the
 * post card and the review queue.
 */
import { AlertTriangle, Clock, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import type { Label, LabelTone } from "@/lib/posts/approval-labels";
import { cn } from "@/lib/utils";

const LABEL_ICON: Readonly<Record<LabelTone, { icon: LucideIcon; className: string }>> = {
  ai: { icon: Sparkles, className: "text-ai" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  critical: { icon: XCircle, className: "text-critical" },
  info: { icon: Clock, className: "text-info" },
  neutral: { icon: Clock, className: "text-muted-foreground" },
};

/** A label tone's icon, in its colour. */
export function LabelToneIcon({ tone, className }: { tone: LabelTone; className?: string }) {
  const { icon: Icon, className: toneClass } = LABEL_ICON[tone];
  return <Icon aria-hidden className={cn("size-4 shrink-0", toneClass, className)} />;
}

/** One label as a line: its icon, then its words. */
export function LabelLine({ label, className }: { label: Label; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-sm text-foreground", className)}>
      <LabelToneIcon tone={label.tone} className="mt-0.5" />
      <span>{label.text}</span>
    </p>
  );
}
